import type { ICommentMigrationPayload, IMigrationDatabaseConfig } from '@/types/migration'

/**
 * 构造评论管理页专用迁移请求，资源范围不可由调用方覆盖。
 * @param dbConfig Typecho 数据库连接配置
 * @returns 固定为 comments-only 的迁移请求
 */
export function buildCommentMigrationPayload(
  dbConfig: IMigrationDatabaseConfig,
): ICommentMigrationPayload {
  return {
    source: 'typecho',
    dbConfig,
    resources: ['comments'],
  }
}
