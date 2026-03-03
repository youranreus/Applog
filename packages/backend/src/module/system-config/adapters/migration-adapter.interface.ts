import type { IDatabaseConfig, IRawPost, IRawPage } from '../dto/migration.dto';

/**
 * 迁移适配器接口
 * 用于从不同的博客系统迁移数据到 AppLog
 */
export interface IMigrationAdapter {
  /**
   * 连接到源数据库
   * @param config 数据库连接配置
   * @returns Promise<void>
   */
  connect(config: IDatabaseConfig): Promise<void>;

  /**
   * 验证数据库连接是否有效
   * @returns Promise<boolean> 连接是否有效
   */
  validateConnection(): Promise<boolean>;

  /**
   * 获取所有文章数据
   * @returns Promise<IRawPost[]> 原始文章数据列表
   */
  fetchPosts(): Promise<IRawPost[]>;

  /**
   * 获取所有页面数据
   * @returns Promise<IRawPage[]> 原始页面数据列表
   */
  fetchPages(): Promise<IRawPage[]>;

  /**
   * 断开数据库连接
   * @returns Promise<void>
   */
  disconnect(): Promise<void>;
}
