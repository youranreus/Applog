import type { IMigrationAdapter } from './base-migration.adapter';
import { TypechoMigrationAdapter } from './typecho-migration.adapter';
import type { MigrationSourceType } from '../types';

/**
 * 数据迁移适配器工厂
 * 根据迁移源类型创建对应的适配器实例
 */
export class MigrationAdapterFactory {
  /**
   * 创建迁移适配器
   * @param type 迁移源类型
   * @returns 对应的迁移适配器实例
   * @throws {Error} 如果不支持的迁移类型
   * 
   * 逻辑说明：
   * 1. 根据 type 参数选择对应的适配器类
   * 2. 创建并返回适配器实例
   * 3. 如果类型不支持，抛出异常
   */
  static create(type: MigrationSourceType): IMigrationAdapter {
    switch (type) {
      case 'typecho':
        return new TypechoMigrationAdapter();
      default:
        throw new Error(`不支持的迁移类型: ${type}`);
    }
  }

  /**
   * 获取所有支持的迁移类型
   * @returns 支持的迁移类型数组
   */
  static getSupportedTypes(): MigrationSourceType[] {
    return ['typecho'];
  }
}
