import type { DataSource } from 'typeorm';
import type { HLogger } from '@reus-able/nestjs';
import type {
  IDatabaseConfig,
  IMigrationResult,
  MigrationSourceType,
} from '../types';

/**
 * 数据迁移适配器接口
 * 定义了所有数据迁移适配器必须实现的方法
 */
export interface IMigrationAdapter {
  /**
   * 获取适配器类型
   */
  getType(): MigrationSourceType;

  /**
   * 执行数据迁移
   * @param sourceConfig 源数据库配置
   * @param targetDataSource 目标数据库连接
   * @param logger 日志记录器
   * @returns 迁移结果
   */
  migrate(
    sourceConfig: IDatabaseConfig,
    targetDataSource: DataSource,
    logger: HLogger,
  ): Promise<IMigrationResult>;

  /**
   * 验证源数据库连接和表结构
   * @param sourceConfig 源数据库配置
   * @returns 是否验证成功
   */
  validateSource(sourceConfig: IDatabaseConfig): Promise<boolean>;
}

/**
 * 数据迁移适配器抽象基类
 * 提供通用的日志记录和错误处理功能
 */
export abstract class BaseMigrationAdapter implements IMigrationAdapter {
  protected logger: HLogger;

  abstract getType(): MigrationSourceType;

  abstract migrate(
    sourceConfig: IDatabaseConfig,
    targetDataSource: DataSource,
    logger: HLogger,
  ): Promise<IMigrationResult>;

  abstract validateSource(sourceConfig: IDatabaseConfig): Promise<boolean>;

  /**
   * 记录普通日志
   * @param message 日志消息
   */
  protected log(message: string): void {
    if (this.logger) {
      this.logger.log(message, `${this.getType()}Adapter`);
    }
  }

  /**
   * 记录警告日志
   * @param message 警告消息
   */
  protected warn(message: string): void {
    if (this.logger) {
      this.logger.warn(message, `${this.getType()}Adapter`);
    }
  }

  /**
   * 记录错误日志
   * @param message 错误消息
   */
  protected error(message: string): void {
    if (this.logger) {
      this.logger.error(message, `${this.getType()}Adapter`);
    }
  }

  /**
   * 创建迁移失败结果
   * @param error 错误信息
   * @param duration 迁移耗时
   * @returns 迁移结果
   */
  protected createFailureResult(
    error: string,
    duration: number,
  ): IMigrationResult {
    return {
      usersCount: 0,
      postsCount: 0,
      pagesCount: 0,
      commentsCount: 0,
      success: false,
      error,
      duration,
    };
  }

  /**
   * 创建迁移成功结果
   * @param counts 各类数据的迁移数量
   * @param duration 迁移耗时
   * @returns 迁移结果
   */
  protected createSuccessResult(
    counts: {
      users: number;
      posts: number;
      pages: number;
      comments: number;
    },
    duration: number,
  ): IMigrationResult {
    return {
      usersCount: counts.users,
      postsCount: counts.posts,
      pagesCount: counts.pages,
      commentsCount: counts.comments,
      success: true,
      duration,
    };
  }
}
