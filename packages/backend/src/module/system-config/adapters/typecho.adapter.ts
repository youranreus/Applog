import { DataSource, DataSourceOptions } from 'typeorm';
import type { HLogger } from '@reus-able/nestjs';
import type { IMigrationAdapter } from './migration-adapter.interface';
import type {
  IDatabaseConfig,
  IRawPost,
  IRawPage,
} from '../dto/migration.dto';

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

interface ITypechoUser {
  uid: number;
  mail: string;
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
    this.log(`正在连接到 Typecho 数据库: ${config.host}:${config.port}/${config.database}`);

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
   * 获取所有文章数据
   * @returns Promise<IRawPost[]> 原始文章数据列表
   *
   * 逻辑说明：
   * 1. 查询 typecho_contents 表，筛选 type = 'post'
   * 2. 关联 typecho_users 表获取作者邮箱
   * 3. 转换时间戳为 Date 对象
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
        title: row.title || '',
        slug: row.slug || '',
        created: row.created,
        modified: row.modified,
        text: row.text || '',
        type: row.type,
        status: row.status,
        authorId: row.authorId,
        authorEmail: (row as any).authorEmail || undefined,
      }));

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
        title: row.title || '',
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
}

