import { shallowRef } from 'vue'
import { useRequest } from 'alova/client'
import { migrateComments } from '@/api/system-config'
import { useLayoutStore } from '@/stores/useLayoutStore'
import type { ICommentMigrationResult, IMigrationDatabaseConfig } from '@/types/migration'

/**
 * 管理评论迁移弹窗、请求结果和成功后的列表刷新。
 * @param onSuccess 迁移成功后的刷新回调
 * @returns 评论迁移状态与操作
 */
export function useCommentMigration(onSuccess: () => Promise<void> | void) {
  const layout = useLayoutStore()
  const open = shallowRef(false)
  const result = shallowRef<ICommentMigrationResult>()
  const error = shallowRef<Error>()

  const { send: requestMigration, loading } = useRequest(
    (dbConfig: IMigrationDatabaseConfig) => migrateComments(dbConfig),
    { immediate: false },
  )

  function openDialog(): void {
    result.value = undefined
    error.value = undefined
    open.value = true
  }

  function closeDialog(): void {
    if (loading.value) return
    open.value = false
  }

  function setOpen(next: boolean): void {
    if (next) openDialog()
    else closeDialog()
  }

  async function migrate(dbConfig: IMigrationDatabaseConfig): Promise<void> {
    error.value = undefined
    result.value = undefined
    try {
      const nextResult = await requestMigration(dbConfig)
      result.value = nextResult
      layout.notify({
        type: 'success',
        title: '评论迁移完成',
        content: `新增 ${nextResult.data.commentsImported} 条，已存在 ${nextResult.data.commentsExisting} 条。`,
      })
      await onSuccess()
    } catch (reason) {
      error.value = reason instanceof Error ? reason : new Error('评论迁移失败，请稍后重试。')
      layout.notify({
        type: 'error',
        title: '评论迁移失败',
        content: error.value.message,
      })
    }
  }

  return {
    open,
    loading,
    result,
    error,
    openDialog,
    closeDialog,
    setOpen,
    migrate,
  }
}
