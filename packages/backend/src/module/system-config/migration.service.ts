import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { PostEntity, PageEntity, UserEntity } from '@/entities';
import type { IMigrationAdapter } from './adapters/migration-adapter.interface';
import { TypechoAdapter } from './adapters/typecho.adapter';
import type {
  MigrateDataDto,
  IMigrationResultDto,
  IMigrationStats,
  IRawPost,
  IRawPage,
  IFieldMapping,
} from './dto/migration.dto';

/**
 * 数据迁移服务
 * 负责从不同的博客系统迁移数据到 AppLog
 */
@Injectable()
export class MigrationService {
  @InjectRepository(PostEntity)
  private postRepo: Repository<PostEntity>;

  @InjectRepository(PageEntity)
  private pageRepo: Repository<PageEntity>;

  @InjectRepository(UserEntity)
  private userRepo: Repository<UserEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(private dataSource: DataSource) {}

  /**
   * 执行数据迁移
   * @param dto 迁移请求参数
   * @param user 当前执行迁移的管理员用户
   * @returns Promise<IMigrationResultDto> 迁移结果
   *
   * 逻辑说明：
   * 1. 根据 source 获取对应的适配器
   * 2. 连接源数据库并验证连接
   * 3. 根据 clearExisting 参数决定是否清空现有数据
   * 4. 获取文章和页面数据
   * 5. 转换并导入数据（批量插入）
   * 6. 统计迁移结果
   * 7. 断开数据库连接
   */
  async migrate(
    dto: MigrateDataDto,
    user: UserJwtPayload,
  ): Promise<IMigrationResultDto> {
    const startTime = Date.now();
    this.log(`开始执行数据迁移，源: ${dto.source}，用户: ${user.id}`);

    let adapter: IMigrationAdapter | null = null;

    try {
      // 1. 获取适配器
      adapter = this.getAdapter(dto.source);
      this.log(`使用适配器: ${dto.source}`);

      // 2. 连接数据库
      await adapter.connect(dto.dbConfig);
      this.log('已连接到源数据库');

      // 3. 验证连接
      const isValid = await adapter.validateConnection();
      if (!isValid) {
        throw new BusinessException('数据库连接验证失败，请检查连接配置');
      }
      this.log('数据库连接验证成功');

      // 4. 清空现有数据（如果需要）
      if (dto.clearExisting) {
        await this.clearExistingData();
        this.log('已清空现有文章和页面数据');
      }

      // 5. 获取原始数据
      this.log('开始获取源数据...');
      const [rawPosts, rawPages] = await Promise.all([
        adapter.fetchPosts(),
        adapter.fetchPages(),
      ]);
      this.log(`获取到 ${rawPosts.length} 篇文章，${rawPages.length} 个页面`);

      // 6. 转换并导入数据
      const stats: IMigrationStats = {
        postsImported: 0,
        pagesImported: 0,
        postsFailed: 0,
        pagesFailed: 0,
        duration: '',
      };

      // 导入文章
      if (rawPosts.length > 0) {
        if (dto.fieldMapping) {
          this.log(`字段映射配置: ${JSON.stringify(dto.fieldMapping)}`);
        }
        const postResult = await this.importPosts(
          rawPosts,
          user.id,
          dto.fieldMapping,
        );
        stats.postsImported = postResult.success;
        stats.postsFailed = postResult.failed;
        this.log(
          `文章导入完成：成功 ${postResult.success}，失败 ${postResult.failed}`,
        );
      }

      // 导入页面
      if (rawPages.length > 0) {
        const pageResult = await this.importPages(rawPages, user.id);
        stats.pagesImported = pageResult.success;
        stats.pagesFailed = pageResult.failed;
        this.log(
          `页面导入完成：成功 ${pageResult.success}，失败 ${pageResult.failed}`,
        );
      }

      // 7. 计算耗时
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      stats.duration = `${duration}s`;

      this.log(`数据迁移完成，耗时: ${stats.duration}`);

      return {
        success: true,
        message: '数据迁移完成',
        data: stats,
      };
    } catch (error) {
      this.error(`数据迁移失败: ${error.message}`);

      if (error instanceof BusinessException) {
        throw error;
      }

      throw new BusinessException(`数据迁移失败: ${error.message}`);
    } finally {
      // 8. 断开连接
      if (adapter) {
        await adapter.disconnect();
      }
    }
  }

  /**
   * 获取适配器实例
   * @param source 数据源类型
   * @returns IMigrationAdapter 适配器实例
   */
  private getAdapter(source: string): IMigrationAdapter {
    switch (source) {
      case 'typecho':
        return new TypechoAdapter(this.logger);
      default:
        throw new BusinessException(`不支持的迁移源: ${source}`);
    }
  }

  /**
   * 清空现有数据
   * @returns Promise<void>
   *
   * 逻辑说明：
   * 1. 使用事务确保原子性
   * 2. 使用 QueryBuilder 删除所有文章和页面数据（delete 方法不允许空条件 {}）
   * 3. 重置自增索引，使导入的数据 ID 从 1 开始
   */
  private async clearExistingData(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 使用 QueryBuilder 删除所有数据（delete 方法不允许空条件 {}）
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(PostEntity)
        .execute();

      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(PageEntity)
        .execute();

      // 重置自增索引，使导入的 ID 从 1 开始
      await queryRunner.query('ALTER TABLE posts AUTO_INCREMENT = 1');
      await queryRunner.query('ALTER TABLE pages AUTO_INCREMENT = 1');

      await queryRunner.commitTransaction();
      this.log('已清空现有数据并重置索引');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.error(`清空数据失败: ${error.message}`);
      throw new BusinessException('清空数据失败');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 导入文章数据
   * @param rawPosts 原始文章数据列表
   * @param defaultAuthorId 默认作者 ID（找不到匹配用户时使用）
   * @param fieldMapping 自定义字段映射配置（可选）
   * @returns Promise<{ success: number; failed: number }> 导入统计
   *
   * 逻辑说明：
   * 1. 批量处理文章（每批 50 条）
   * 2. 为每篇文章映射作者（根据邮箱匹配）
   * 3. 转换状态和时间戳
   * 4. 应用自定义字段映射规则（如果配置了）
   * 5. 将 slug 存入 extra 字段
   * 6. 批量插入数据库
   */
  private async importPosts(
    rawPosts: IRawPost[],
    defaultAuthorId: number,
    fieldMapping?: IFieldMapping,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 批量处理，每批 50 条
    const batchSize = 50;
    for (let i = 0; i < rawPosts.length; i += batchSize) {
      const batch = rawPosts.slice(i, i + batchSize);

      try {
        // 批量映射作者
        const postsToInsert = await Promise.all(
          batch.map(async (rawPost) => {
            try {
              const authorId = await this.mapAuthor(
                rawPost.authorEmail,
                defaultAuthorId,
              );

              // 转换状态
              const status = this.mapStatus(rawPost.status);

              // 转换时间戳
              const createdAt = new Date(rawPost.created * 1000);
              const updatedAt = new Date(rawPost.modified * 1000);

              // 应用自定义字段映射
              const postData: Partial<PostEntity> = {
                title: rawPost.title || '无标题',
                content: rawPost.text || '',
                status,
                authorId,
                viewCount: 0,
                tags: rawPost.tags || [],
              };

              // 如果配置了字段映射，应用映射规则
              if (fieldMapping && rawPost.customFields) {
                for (const [typechoField, postField] of Object.entries(
                  fieldMapping,
                )) {
                  const fieldValue = rawPost.customFields[typechoField];

                  // 如果字段值为空，跳过
                  if (!fieldValue) {
                    continue;
                  }

                  // 目前只支持映射到 cover 字段
                  if (postField === 'cover') {
                    postData.cover = fieldValue;
                    this.log(
                      `文章 cid=${rawPost.cid}: 映射字段 ${typechoField} -> cover = ${fieldValue}`,
                    );
                  } else {
                    // 不支持的目标字段，记录警告但不中断迁移
                    this.warn(
                      `不支持的目标字段映射: ${typechoField} -> ${postField}，已忽略`,
                    );
                  }
                }
              }

              // 记录 tags 迁移信息
              if (rawPost.tags && rawPost.tags.length > 0) {
                this.log(
                  `文章 cid=${rawPost.cid}: 迁移 ${rawPost.tags.length} 个分类/标签: ${rawPost.tags.join(', ')}`,
                );
              }

              // 构建 extra 对象，包含 slug
              const extra: Record<string, any> = {
                slug: rawPost.slug || '',
                migratedFrom: 'typecho',
                originalId: rawPost.cid,
              };

              return this.postRepo.create({
                ...postData,
                extra,
                createdAt,
                updatedAt,
              });
            } catch (error) {
              this.warn(`转换文章失败 (cid: ${rawPost.cid}): ${error.message}`);
              throw error;
            }
          }),
        );

        // 批量插入
        await this.postRepo.save(postsToInsert);
        success += postsToInsert.length;
      } catch (error) {
        this.error(`批量导入文章失败: ${error.message}`);
        failed += batch.length;
      }
    }

    return { success, failed };
  }

  /**
   * 导入页面数据
   * @param rawPages 原始页面数据列表
   * @param defaultAuthorId 默认作者 ID（找不到匹配用户时使用）
   * @returns Promise<{ success: number; failed: number }> 导入统计
   *
   * 逻辑说明：
   * 1. 批量处理页面（每批 50 条）
   * 2. 为每个页面映射作者（根据邮箱匹配）
   * 3. 转换状态和时间戳
   * 4. 直接映射 slug 字段
   * 5. showInNav 和 showInFooter 默认为 false
   * 6. 批量插入数据库
   */
  private async importPages(
    rawPages: IRawPage[],
    defaultAuthorId: number,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 批量处理，每批 50 条
    const batchSize = 50;
    for (let i = 0; i < rawPages.length; i += batchSize) {
      const batch = rawPages.slice(i, i + batchSize);

      try {
        // 批量映射作者
        const pagesToInsert = await Promise.all(
          batch.map(async (rawPage) => {
            try {
              const authorId = await this.mapAuthor(
                rawPage.authorEmail,
                defaultAuthorId,
              );

              // 转换状态
              const status = this.mapStatus(rawPage.status);

              // 转换时间戳
              const createdAt = new Date(rawPage.created * 1000);
              const updatedAt = new Date(rawPage.modified * 1000);

              // 生成 slug（如果为空则使用标题）
              let slug = rawPage.slug || '';
              if (!slug) {
                slug = this.generateSlugFromTitle(rawPage.title);
              }

              // 检查 slug 是否已存在，如果存在则添加后缀
              const existingPage = await this.pageRepo.findOne({
                where: { slug },
              });
              if (existingPage) {
                slug = `${slug}-${rawPage.cid}`;
              }

              // 构建 extra 对象
              const extra: Record<string, any> = {
                migratedFrom: 'typecho',
                originalId: rawPage.cid,
              };

              return this.pageRepo.create({
                title: rawPage.title || '无标题',
                content: rawPage.text || '',
                slug,
                status,
                authorId,
                viewCount: 0,
                showInNav: false,
                showInFooter: false,
                tags: [],
                extra,
                createdAt,
                updatedAt,
              });
            } catch (error) {
              this.warn(`转换页面失败 (cid: ${rawPage.cid}): ${error.message}`);
              throw error;
            }
          }),
        );

        // 批量插入
        await this.pageRepo.save(pagesToInsert);
        success += pagesToInsert.length;
      } catch (error) {
        this.error(`批量导入页面失败: ${error.message}`);
        failed += batch.length;
      }
    }

    return { success, failed };
  }

  /**
   * 根据邮箱映射作者 ID
   * @param email 作者邮箱
   * @param defaultAuthorId 默认作者 ID（找不到时使用）
   * @returns Promise<number> 作者 ID
   *
   * 逻辑说明：
   * 1. 如果邮箱为空，直接返回默认作者 ID
   * 2. 在 AppLog 用户表中查找匹配的邮箱
   * 3. 找到则返回该用户的数据库 ID
   * 4. 找不到则返回默认作者 ID
   */
  private async mapAuthor(
    email: string | undefined,
    defaultAuthorId: number,
  ): Promise<number> {
    if (!email) {
      return defaultAuthorId;
    }

    try {
      const user = await this.userRepo.findOne({
        where: { email },
      });

      if (user) {
        this.log(`找到匹配用户: ${email} -> ${user.id}`);
        return user.id;
      }

      this.warn(
        `未找到匹配用户: ${email}，使用默认作者 ID: ${defaultAuthorId}`,
      );
      return defaultAuthorId;
    } catch (error) {
      this.error(`查找用户失败: ${error.message}`);
      return defaultAuthorId;
    }
  }

  /**
   * 转换状态
   * @param status Typecho 状态
   * @returns AppLog 状态
   *
   * 逻辑说明：
   * - 'publish' -> 'published'
   * - 'draft' -> 'draft'
   * - 其他 -> 'archived'
   */
  private mapStatus(status: string): 'draft' | 'published' | 'archived' {
    switch (status) {
      case 'publish':
        return 'published';
      case 'draft':
        return 'draft';
      default:
        return 'archived';
    }
  }

  /**
   * 从标题生成 slug
   * @param title 标题
   * @returns slug 字符串
   */
  private generateSlugFromTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/-+/g, '-') // 多个连字符合并为一个
      .trim();
  }

  private log(message: string) {
    this.logger.log(message, MigrationService.name);
  }

  private warn(message: string) {
    this.logger.warn(message, MigrationService.name);
  }

  private error(message: string) {
    this.logger.error(message, MigrationService.name);
  }
}
