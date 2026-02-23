import { DataSource, DataSourceOptions } from 'typeorm';
import type { HLogger } from '@reus-able/nestjs';
import type { IMigrationAdapter } from './migration-adapter.interface';
import type { IDatabaseConfig, IRawPost, IRawPage } from '../dto/migration.dto';

/**
 * Typecho 数据库原始数据接口
 */
interface ITypechoContent {
  cid: number;
  title: string;
  slug: string;
  created: number;
  modified: number;
  text: string;
  type: string;
  status: string;
  authorId: number;
}

/**
 * Typecho fields 表数据结构
 */
interface ITypechoField {
  cid: number;
  name: string;
  type: string;
  str_value: string;
  int_value: number;
  float_value: number;
}

/**
 * Typecho 数据迁移适配器
 * 负责从 Typecho 数据库读取文章和页面数据
 */
export class TypechoAdapter implements IMigrationAdapter {
  private logger: HLogger;
  private connection: DataSource | null = null;
  private config: IDatabaseConfig | null = null;

  constructor(logger: HLogger) {
    this.logger = logger;
  }

  /**
   * 连接到 Typecho 数据库
   * @param config 数据库连接配置
   * @returns Promise<void>
   *
   * 逻辑说明：
   * 1. 保存配置信息
   * 2. 创建 TypeORM DataSource 连接
   * 3. 初始化连接
   */
  async connect(config: IDatabaseConfig): Promise<void> {
    this.log(
      `正在连接到 Typecho 数据库: ${config.host}:${config.port}/${config.database}`,
    );

    try {
      this.config = config;

      const dataSourceOptions: DataSourceOptions = {
        type: 'mysql',
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        synchronize: false,
        logging: false,
        entities: [],
      };

      this.connection = new DataSource(dataSourceOptions);
      await this.connection.initialize();

      this.log(`成功连接到 Typecho 数据库`);
    } catch (error) {
      this.error(`连接 Typecho 数据库失败: ${error.message}`);
      throw new Error(`连接数据库失败: ${error.message}`);
    }
  }

  /**
   * 验证数据库连接是否有效
   * @returns Promise<boolean> 连接是否有效
   *
   * 逻辑说明：
   * 1. 执行简单的查询测试连接
   * 2. 检查表是否存在
   */
  async validateConnection(): Promise<boolean> {
    if (!this.connection || !this.connection.isInitialized) {
      this.warn('数据库连接未初始化');
      return false;
    }

    try {
      const tablePrefix = this.config?.tablePrefix || 'typecho_';
      const contentsTable = `${tablePrefix}contents`;

      // 执行简单查询验证连接和表是否存在
      await this.connection.query(`SELECT 1 FROM \`${contentsTable}\` LIMIT 1`);

      this.log('数据库连接验证成功');
      return true;
    } catch (error) {
      this.error(`数据库连接验证失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取文章的自定义字段数据
   * @param cids 文章 cid 列表
   * @returns Promise<Map<number, Record<string, string>>> 自定义字段数据
   *          key: 文章 cid，value: 该文章的自定义字段对象（字段名 -> 字段值）
   *
   * 逻辑说明：
   * 1. 查询 {tablePrefix}_fields 表，筛选 cid 在指定列表中
   * 2. 只处理 str_value（字符串类型字段），因为目前只映射 cover（URL 字符串）
   * 3. 按 cid 分组，返回 Map 结构
   */
  async fetchFields(
    cids: number[],
  ): Promise<Map<number, Record<string, string>>> {
    if (!this.connection || !this.connection.isInitialized) {
      throw new Error('数据库连接未初始化');
    }

    if (cids.length === 0) {
      return new Map();
    }

    try {
      const tablePrefix = this.config?.tablePrefix || 'typecho_';
      const fieldsTable = `${tablePrefix}fields`;

      this.log(
        `开始获取 Typecho 自定义字段数据，表: ${fieldsTable}，文章数量: ${cids.length}`,
      );

      // 构建 IN 查询（直接拼接数字，因为 cids 都是数字，不会有 SQL 注入风险）
      const cidsStr = cids.join(',');

      // 查询自定义字段数据
      const query = `
        SELECT 
          cid,
          name,
          type,
          str_value,
          int_value,
          float_value
        FROM \`${fieldsTable}\`
        WHERE cid IN (${cidsStr})
        AND str_value IS NOT NULL
        AND str_value != ''
      `;

      const results: ITypechoField[] = await this.connection.query(query);

      this.log(`成功获取 ${results.length} 条自定义字段数据`);

      // 按 cid 分组，构建 Map
      const fieldsMap = new Map<number, Record<string, string>>();

      for (const field of results) {
        if (!fieldsMap.has(field.cid)) {
          fieldsMap.set(field.cid, {});
        }

        const postFields = fieldsMap.get(field.cid)!;
        postFields[field.name] = field.str_value;
      }

      this.log(`成功构建 ${fieldsMap.size} 篇文章的自定义字段映射`);

      return fieldsMap;
    } catch (error) {
      this.error(`获取自定义字段数据失败: ${error.message}`);
      // 如果 fields 表不存在，返回空 Map，不中断迁移流程
      if (
        error.message.includes("doesn't exist") ||
        error.message.includes('Unknown table')
      ) {
        this.warn('fields 表不存在，跳过自定义字段获取');
        return new Map();
      }
      throw new Error(`获取自定义字段数据失败: ${error.message}`);
    }
  }

  /**
   * 获取文章的分类和标签
   * @param cids 文章 cid 列表
   * @returns Promise<Map<number, string[]>>
   *          key: 文章 cid，value: 该文章的分类和标签名称数组
   *
   * 逻辑说明：
   * 1. 通过 relationships 表关联 metas 表
   * 2. 筛选 type 为 category 或 tag 的元数据
   * 3. 按 cid 分组，返回每篇文章的分类和标签名称列表
   */
  async fetchTagsAndCategories(cids: number[]): Promise<Map<number, string[]>> {
    if (!this.connection || !this.connection.isInitialized) {
      throw new Error('数据库连接未初始化');
    }

    if (cids.length === 0) {
      return new Map();
    }

    try {
      const tablePrefix = this.config?.tablePrefix || 'typecho_';
      const relationshipsTable = `${tablePrefix}relationships`;
      const metasTable = `${tablePrefix}metas`;

      this.log(`开始获取 Typecho 分类和标签数据，文章数量: ${cids.length}`);

      // 构建 IN 查询（直接拼接数字，因为 cids 都是数字，不会有 SQL 注入风险）
      const cidsStr = cids.join(',');

      // 查询分类和标签数据
      const query = `
        SELECT 
          r.cid,
          m.name,
          m.type
        FROM \`${relationshipsTable}\` r
        INNER JOIN \`${metasTable}\` m ON r.mid = m.mid
        WHERE r.cid IN (${cidsStr})
          AND m.type IN ('category', 'tag')
        ORDER BY r.cid, m.type, m.name
      `;

      const results: Array<{ cid: number; name: string; type: string }> =
        await this.connection.query(query);

      this.log(`成功获取 ${results.length} 条分类和标签数据`);

      // 按 cid 分组，构建 Map
      const tagsMap = new Map<number, string[]>();

      for (const row of results) {
        if (!tagsMap.has(row.cid)) {
          tagsMap.set(row.cid, []);
        }
        tagsMap.get(row.cid)!.push(row.name);
      }

      this.log(`成功构建 ${tagsMap.size} 篇文章的分类和标签映射`);

      return tagsMap;
    } catch (error) {
      this.error(`获取分类和标签数据失败: ${error.message}`);
      // 如果表不存在，返回空 Map，不中断迁移流程
      if (
        error.message.includes("doesn't exist") ||
        error.message.includes('Unknown table')
      ) {
        this.warn('metas 或 relationships 表不存在，跳过分类和标签获取');
        return new Map();
      }
      throw new Error(`获取分类和标签数据失败: ${error.message}`);
    }
  }

  /**
   * 获取所有文章数据
   * @returns Promise<IRawPost[]> 原始文章数据列表
   *
   * 逻辑说明：
   * 1. 查询 typecho_contents 表，筛选 type = 'post'
   * 2. 关联 typecho_users 表获取作者邮箱
   * 3. 查询自定义字段数据并附加到每篇文章
   * 4. 返回文章数据列表
   */
  async fetchPosts(): Promise<IRawPost[]> {
    if (!this.connection || !this.connection.isInitialized) {
      throw new Error('数据库连接未初始化');
    }

    try {
      const tablePrefix = this.config?.tablePrefix || 'typecho_';
      const contentsTable = `${tablePrefix}contents`;
      const usersTable = `${tablePrefix}users`;

      this.log(`开始获取 Typecho 文章数据，表: ${contentsTable}`);

      // 查询文章数据，关联用户表获取邮箱
      const query = `
        SELECT 
          c.cid,
          c.title,
          c.slug,
          c.created,
          c.modified,
          c.text,
          c.type,
          c.status,
          c.authorId,
          u.mail as authorEmail
        FROM \`${contentsTable}\` c
        LEFT JOIN \`${usersTable}\` u ON c.authorId = u.uid
        WHERE c.type = 'post'
        ORDER BY c.created ASC
      `;

      const results: ITypechoContent[] = await this.connection.query(query);

      this.log(`成功获取 ${results.length} 篇文章数据`);

      // 转换为 IRawPost 格式
      const posts: IRawPost[] = results.map((row) => ({
        cid: row.cid,
        title: this.decodeHtmlEntities(row.title || ''),
        slug: row.slug || '',
        created: row.created,
        modified: row.modified,
        text: row.text || '',
        type: row.type,
        status: row.status,
        authorId: row.authorId,
        authorEmail: (row as any).authorEmail || undefined,
      }));

      // 获取自定义字段数据
      if (posts.length > 0) {
        const cids = posts.map((post) => post.cid);
        const fieldsMap = await this.fetchFields(cids);

        // 获取分类和标签数据
        const tagsMap = await this.fetchTagsAndCategories(cids);

        // 将自定义字段和标签附加到每篇文章
        for (const post of posts) {
          const customFields = fieldsMap.get(post.cid);
          if (customFields && Object.keys(customFields).length > 0) {
            post.customFields = customFields;
          }

          // 附加分类和标签
          const tags = tagsMap.get(post.cid);
          if (tags && tags.length > 0) {
            post.tags = tags;
          }
        }

        const postsWithFields = posts.filter((post) => post.customFields);
        const postsWithTags = posts.filter((post) => post.tags);
        this.log(`其中 ${postsWithFields.length} 篇文章包含自定义字段`);
        this.log(`其中 ${postsWithTags.length} 篇文章包含分类或标签`);
      }

      return posts;
    } catch (error) {
      this.error(`获取文章数据失败: ${error.message}`);
      throw new Error(`获取文章数据失败: ${error.message}`);
    }
  }

  /**
   * 获取所有页面数据
   * @returns Promise<IRawPage[]> 原始页面数据列表
   *
   * 逻辑说明：
   * 1. 查询 typecho_contents 表，筛选 type = 'page'
   * 2. 关联 typecho_users 表获取作者邮箱
   * 3. 转换时间戳为 Date 对象
   * 4. 返回页面数据列表
   */
  async fetchPages(): Promise<IRawPage[]> {
    if (!this.connection || !this.connection.isInitialized) {
      throw new Error('数据库连接未初始化');
    }

    try {
      const tablePrefix = this.config?.tablePrefix || 'typecho_';
      const contentsTable = `${tablePrefix}contents`;
      const usersTable = `${tablePrefix}users`;

      this.log(`开始获取 Typecho 页面数据，表: ${contentsTable}`);

      // 查询页面数据，关联用户表获取邮箱
      const query = `
        SELECT 
          c.cid,
          c.title,
          c.slug,
          c.created,
          c.modified,
          c.text,
          c.type,
          c.status,
          c.authorId,
          u.mail as authorEmail
        FROM \`${contentsTable}\` c
        LEFT JOIN \`${usersTable}\` u ON c.authorId = u.uid
        WHERE c.type = 'page'
        ORDER BY c.created ASC
      `;

      const results: ITypechoContent[] = await this.connection.query(query);

      this.log(`成功获取 ${results.length} 个页面数据`);

      // 转换为 IRawPage 格式
      const pages: IRawPage[] = results.map((row) => ({
        cid: row.cid,
        title: this.decodeHtmlEntities(row.title || ''),
        slug: row.slug || '',
        created: row.created,
        modified: row.modified,
        text: row.text || '',
        type: row.type,
        status: row.status,
        authorId: row.authorId,
        authorEmail: (row as any).authorEmail || undefined,
      }));

      return pages;
    } catch (error) {
      this.error(`获取页面数据失败: ${error.message}`);
      throw new Error(`获取页面数据失败: ${error.message}`);
    }
  }

  /**
   * 断开数据库连接
   * @returns Promise<void>
   *
   * 逻辑说明：
   * 1. 检查连接是否存在且已初始化
   * 2. 关闭连接
   * 3. 清理连接对象
   */
  async disconnect(): Promise<void> {
    if (this.connection && this.connection.isInitialized) {
      try {
        await this.connection.destroy();
        this.log('已断开 Typecho 数据库连接');
      } catch (error) {
        this.error(`断开数据库连接失败: ${error.message}`);
      } finally {
        this.connection = null;
        this.config = null;
      }
    }
  }

  private log(message: string) {
    this.logger.log(message, TypechoAdapter.name);
  }

  private warn(message: string) {
    this.logger.warn(message, TypechoAdapter.name);
  }

  private error(message: string) {
    this.logger.error(message, TypechoAdapter.name);
  }

  /**
   * 将 Typecho 存储的 HTML 实体解码为普通字符
   * @param text - 可能包含 HTML 实体的字符串（如 &amp;、&lt;、&#59; 等）
   * @returns 解码后的纯文本
   *
   * 逻辑说明：
   * 1. 先处理数字实体（&#十进制;、&#x十六进制;），避免 &amp; 被先替换导致二次解析错误
   * 2. 再按顺序替换命名实体（&amp;、&lt;、&gt;、&quot;、&apos;、&#39;、&nbsp;）
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .replace(/&#([0-9]+);/g, (_, dec) =>
        String.fromCharCode(parseInt(dec, 10)),
      )
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
