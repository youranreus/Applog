import { alovaInstance } from '@/utils/alova'
import type { ICommentMigrationResult, IMigrationDatabaseConfig } from '@/types/migration'
import { buildCommentMigrationPayload } from './commentMigrationPayload'

/**
 * 从 Typecho 远程数据库迁移评论数据。
 * @param dbConfig Typecho 数据库连接配置
 * @returns 评论迁移请求 Method
 */
export function migrateComments(dbConfig: IMigrationDatabaseConfig) {
  return alovaInstance.Post<ICommentMigrationResult>(
    '/config/migrate',
    buildCommentMigrationPayload(dbConfig),
  )
}
