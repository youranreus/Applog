import { createConnection, DataSource } from 'typeorm';
import type { HLogger } from '@reus-able/nestjs';
import { UserEntity, PostEntity, PageEntity, CommentEntity } from '@/entities';
import { BaseMigrationAdapter } from './base-migration.adapter';
import type {
  IDatabaseConfig,
  IMigrationResult,
  ITypechoUser,
  ITypechoContent,
  ITypechoComment,
  ITypechoMeta,
  ITypechoRelationship,
} from '../types';

/**
 * Typecho 数据迁移适配器
 * 负责将 Typecho 博客系统的数据迁移到 AppLog 系统
 */
export class TypechoMigrationAdapter extends BaseMigrationAdapter {
  private sourceConnection: DataSource;
  private userIdMap: Map<number, number> = new Map(); // typecho uid -> applog id
  private contentIdMap: Map<number, number> = new Map(); // typecho cid -> applog id
  private metaMap: Map<number, ITypechoMeta> = new Map(); // typecho mid -> meta

  getType() {
    return 'typecho' as const;
  }

  /**
   * 验证源数据库连接和表结构
   * @param sourceConfig 源数据库配置
   * @returns 验证是否成功
   * 
   * 逻辑说明：
   * 1. 尝试连接源数据库
   * 2. 检查必需的表是否存在
   * 3. 关闭测试连接
   */
  async validateSource(sourceConfig: IDatabaseConfig): Promise<boolean> {
    try {
      this.log('开始验证 Typecho 数据库连接...');

      const testConnection = await createConnection({
        type: 'mysql',
        host: sourceConfig.host,
        port: sourceConfig.port,
        username: sourceConfig.username,
        password: sourceConfig.password,
        database: sourceConfig.database,
      });

      const prefix = sourceConfig.tablePrefix || 'typecho_';
      const requiredTables = ['users', 'contents', 'comments', 'metas'];

      for (const table of requiredTables) {
        const tableName = `${prefix}${table}`;
        const result = await testConnection.query(
          `SHOW TABLES LIKE '${tableName}'`,
        );

        if (!result || result.length === 0) {
          this.error(`表 ${tableName} 不存在`);
          await testConnection.destroy();
          return false;
        }
      }

      await testConnection.destroy();
      this.log('Typecho 数据库验证成功');
      return true;
    } catch (err) {
      this.error(`验证数据库失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 执行完整的数据迁移流程
   * @param sourceConfig 源数据库配置
   * @param targetDataSource 目标数据库连接
   * @param logger 日志记录器
   * @returns 迁移结果统计
   * 
   * 逻辑说明：
   * 1. 连接源数据库
   * 2. 依次迁移：用户 -> 内容元数据 -> 文章/页面 -> 评论
   * 3. 使用事务确保数据一致性
   * 4. 记录迁移耗时和统计信息
   */
  async migrate(
    sourceConfig: IDatabaseConfig,
    targetDataSource: DataSource,
    logger: HLogger,
  ): Promise<IMigrationResult> {
    this.logger = logger;
    const startTime = Date.now();

    try {
      this.log('开始 Typecho 数据迁移...');

      // 连接源数据库
      this.sourceConnection = await createConnection({
        name: 'typecho_source',
        type: 'mysql',
        host: sourceConfig.host,
        port: sourceConfig.port,
        username: sourceConfig.username,
        password: sourceConfig.password,
        database: sourceConfig.database,
      });

      const prefix = sourceConfig.tablePrefix || 'typecho_';

      // 开始事务迁移
      const queryRunner = targetDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. 迁移用户
        const usersCount = await this.migrateUsers(prefix, queryRunner.manager);
        this.log(`用户迁移完成: ${usersCount} 条`);

        // 2. 加载元数据（标签、分类）
        await this.loadMetas(prefix);
        this.log('元数据加载完成');

        // 3. 迁移文章和页面
        const { posts, pages } = await this.migrateContents(
          prefix,
          queryRunner.manager,
        );
        this.log(`内容迁移完成: 文章 ${posts} 条, 页面 ${pages} 条`);

        // 4. 迁移评论
        const commentsCount = await this.migrateComments(
          prefix,
          queryRunner.manager,
        );
        this.log(`评论迁移完成: ${commentsCount} 条`);

        // 提交事务
        await queryRunner.commitTransaction();

        const duration = Date.now() - startTime;
        this.log(`数据迁移成功完成，耗时: ${duration}ms`);

        return this.createSuccessResult(
          {
            users: usersCount,
            posts,
            pages,
            comments: commentsCount,
          },
          duration,
        );
      } catch (err) {
        // 回滚事务
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
        await this.sourceConnection.destroy();
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      this.error(`数据迁移失败: ${err.message}`);
      return this.createFailureResult(err.message, duration);
    }
  }

  /**
   * 迁移用户数据
   * @param prefix 表前缀
   * @param manager 目标数据库 Manager
   * @returns 迁移的用户数量
   * 
   * 逻辑说明：
   * 1. 从 typecho_users 表读取所有用户
   * 2. 将 Typecho 用户数据映射为 AppLog UserEntity
   * 3. 保存到目标数据库
   * 4. 记录 ID 映射关系供后续使用
   */
  private async migrateUsers(prefix: string, manager: any): Promise<number> {
    this.log('开始迁移用户数据...');

    const typechoUsers = await this.sourceConnection.query<ITypechoUser[]>(
      `SELECT * FROM ${prefix}users`,
    );

    let count = 0;
    for (const tUser of typechoUsers) {
      const user = new UserEntity();
      user.name = tUser.screenName || tUser.name;
      user.email = tUser.mail;
      user.avatar = null;
      user.ssoId = tUser.uid; // 使用原 uid 作为 ssoId
      user.role = tUser.group === 'administrator' ? 'admin' : 'user';
      user.createdAt = new Date(tUser.created * 1000);
      user.updatedAt = new Date(tUser.activated * 1000);

      const savedUser = await manager.save(UserEntity, user);
      this.userIdMap.set(tUser.uid, savedUser.id);
      count++;
    }

    return count;
  }

  /**
   * 加载元数据（标签、分类）
   * @param prefix 表前缀
   * 
   * 逻辑说明：
   * 1. 从 typecho_metas 表读取所有元数据
   * 2. 存储到内存 Map 中供后续关联使用
   */
  private async loadMetas(prefix: string): Promise<void> {
    this.log('开始加载元数据...');

    const typechoMetas = await this.sourceConnection.query<ITypechoMeta[]>(
      `SELECT * FROM ${prefix}metas`,
    );

    for (const meta of typechoMetas) {
      this.metaMap.set(meta.mid, meta);
    }

    this.log(`加载了 ${typechoMetas.length} 条元数据`);
  }

  /**
   * 迁移内容（文章和页面）
   * @param prefix 表前缀
   * @param manager 目标数据库 Manager
   * @returns 文章和页面的迁移数量
   * 
   * 逻辑说明：
   * 1. 从 typecho_contents 表读取所有内容
   * 2. 根据 type 字段区分文章和页面
   * 3. 加载关联的标签/分类
   * 4. 将数据映射为对应的 Entity
   * 5. 保存到目标数据库
   */
  private async migrateContents(
    prefix: string,
    manager: any,
  ): Promise<{ posts: number; pages: number }> {
    this.log('开始迁移内容数据...');

    const typechoContents =
      await this.sourceConnection.query<ITypechoContent[]>(
        `SELECT * FROM ${prefix}contents`,
      );

    // 加载内容与元数据的关系
    const relationships =
      await this.sourceConnection.query<ITypechoRelationship[]>(
        `SELECT * FROM ${prefix}relationships`,
      );

    // 构建内容ID -> 标签名称数组的映射
    const contentTagsMap = new Map<number, string[]>();
    for (const rel of relationships) {
      const meta = this.metaMap.get(rel.mid);
      if (meta && meta.type === 'tag') {
        if (!contentTagsMap.has(rel.cid)) {
          contentTagsMap.set(rel.cid, []);
        }
        contentTagsMap.get(rel.cid).push(meta.name);
      }
    }

    let postsCount = 0;
    let pagesCount = 0;

    for (const tContent of typechoContents) {
      const authorId = this.userIdMap.get(tContent.authorId);
      if (!authorId) {
        this.warn(`内容 ${tContent.cid} 的作者 ${tContent.authorId} 不存在，跳过`);
        continue;
      }

      // 根据类型创建文章或页面
      if (tContent.type === 'post') {
        const post = await this.createPost(tContent, authorId, manager);
        if (post) {
          post.tags = contentTagsMap.get(tContent.cid) || [];
          const savedPost = await manager.save(PostEntity, post);
          this.contentIdMap.set(tContent.cid, savedPost.id);
          postsCount++;
        }
      } else if (tContent.type === 'page') {
        const page = await this.createPage(tContent, authorId, manager);
        if (page) {
          page.tags = contentTagsMap.get(tContent.cid) || [];
          const savedPage = await manager.save(PageEntity, page);
          this.contentIdMap.set(tContent.cid, savedPage.id);
          pagesCount++;
        }
      }
    }

    return { posts: postsCount, pages: pagesCount };
  }

  /**
   * 创建文章实体
   * @param tContent Typecho 内容数据
   * @param authorId AppLog 作者ID
   * @param manager 目标数据库 Manager
   * @returns PostEntity 实例
   */
  private async createPost(
    tContent: ITypechoContent,
    authorId: number,
    manager: any,
  ): Promise<PostEntity> {
    const post = new PostEntity();
    post.title = tContent.title;
    post.content = tContent.text;
    post.summary = this.extractSummary(tContent.text);
    post.status = this.mapStatus(tContent.status);
    post.viewCount = 0;
    post.authorId = authorId;
    post.extra = {
      typechoId: tContent.cid,
      slug: tContent.slug,
      allowComment: tContent.allowComment === '1',
    };
    post.createdAt = new Date(tContent.created * 1000);
    post.updatedAt = new Date(tContent.modified * 1000);

    return post;
  }

  /**
   * 创建页面实体
   * @param tContent Typecho 内容数据
   * @param authorId AppLog 作者ID
   * @param manager 目标数据库 Manager
   * @returns PageEntity 实例
   */
  private async createPage(
    tContent: ITypechoContent,
    authorId: number,
    manager: any,
  ): Promise<PageEntity> {
    const page = new PageEntity();
    page.title = tContent.title;
    page.content = tContent.text;
    page.summary = this.extractSummary(tContent.text);
    page.slug = tContent.slug;
    page.status = this.mapStatus(tContent.status);
    page.viewCount = 0;
    page.showInNav = false;
    page.showInFooter = false;
    page.authorId = authorId;
    page.extra = {
      typechoId: tContent.cid,
      template: tContent.template,
      allowComment: tContent.allowComment === '1',
    };
    page.createdAt = new Date(tContent.created * 1000);
    page.updatedAt = new Date(tContent.modified * 1000);

    return page;
  }

  /**
   * 迁移评论数据
   * @param prefix 表前缀
   * @param manager 目标数据库 Manager
   * @returns 迁移的评论数量
   * 
   * 逻辑说明：
   * 1. 从 typecho_comments 表读取所有评论
   * 2. 将评论关联到对应的文章（使用 contentIdMap）
   * 3. 处理游客评论和注册用户评论
   * 4. 保存到目标数据库
   */
  private async migrateComments(
    prefix: string,
    manager: any,
  ): Promise<number> {
    this.log('开始迁移评论数据...');

    const typechoComments =
      await this.sourceConnection.query<ITypechoComment[]>(
        `SELECT * FROM ${prefix}comments WHERE type = 'comment'`,
      );

    let count = 0;
    const commentIdMap = new Map<number, number>(); // typecho coid -> applog id

    // 第一轮：创建所有评论（不处理父评论关系）
    for (const tComment of typechoComments) {
      const postId = this.contentIdMap.get(tComment.cid);
      if (!postId) {
        this.warn(`评论 ${tComment.coid} 关联的内容 ${tComment.cid} 不存在，跳过`);
        continue;
      }

      const comment = new CommentEntity();
      comment.content = tComment.text;
      comment.postId = postId;
      comment.status = this.mapCommentStatus(tComment.status);
      comment.likeCount = 0;
      comment.ip = tComment.ip;

      // 判断是注册用户还是游客
      if (tComment.authorId > 0) {
        const userId = this.userIdMap.get(tComment.authorId);
        if (userId) {
          comment.authorId = userId;
        } else {
          // 如果用户不存在，作为游客处理
          comment.authorId = 0;
          comment.guestName = tComment.author;
          comment.guestEmail = tComment.mail;
          comment.guestSite = tComment.url;
        }
      } else {
        // 游客评论
        comment.authorId = 0;
        comment.guestName = tComment.author;
        comment.guestEmail = tComment.mail;
        comment.guestSite = tComment.url;
      }

      comment.extra = {
        typechoId: tComment.coid,
        agent: tComment.agent,
      };
      comment.createdAt = new Date(tComment.created * 1000);
      comment.updatedAt = new Date(tComment.created * 1000);

      const savedComment = await manager.save(CommentEntity, comment);
      commentIdMap.set(tComment.coid, savedComment.id);
      count++;
    }

    // 第二轮：更新父评论关系
    for (const tComment of typechoComments) {
      if (tComment.parent > 0) {
        const commentId = commentIdMap.get(tComment.coid);
        const parentId = commentIdMap.get(tComment.parent);

        if (commentId && parentId) {
          await manager.update(CommentEntity, commentId, {
            parentId,
          });
        }
      }
    }

    return count;
  }

  /**
   * 从内容中提取摘要
   * @param content 文章内容
   * @returns 摘要文本（最多150字符）
   */
  private extractSummary(content: string): string {
    // 移除 HTML 标签和 Markdown 语法
    const plainText = content
      .replace(/<[^>]*>/g, '')
      .replace(/[#*_`~\[\]]/g, '')
      .trim();

    // 截取前150个字符
    return plainText.length > 150
      ? plainText.substring(0, 150) + '...'
      : plainText;
  }

  /**
   * 映射内容状态
   * @param typechoStatus Typecho 状态
   * @returns AppLog 状态
   */
  private mapStatus(
    typechoStatus: string,
  ): 'draft' | 'published' | 'archived' {
    switch (typechoStatus) {
      case 'publish':
        return 'published';
      case 'draft':
        return 'draft';
      case 'hidden':
      case 'private':
        return 'archived';
      default:
        return 'draft';
    }
  }

  /**
   * 映射评论状态
   * @param typechoStatus Typecho 评论状态
   * @returns AppLog 评论状态
   */
  private mapCommentStatus(
    typechoStatus: string,
  ): 'pending' | 'approved' | 'rejected' {
    switch (typechoStatus) {
      case 'approved':
        return 'approved';
      case 'waiting':
        return 'pending';
      case 'spam':
        return 'rejected';
      default:
        return 'pending';
    }
  }
}
