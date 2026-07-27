import { onMounted, ref, shallowRef } from 'vue'
import { useRequest } from 'alova/client'
import {
  deleteComment,
  getAdminComments,
  getCommentDeleteImpact,
  moderateComment,
} from '@/api/comment'
import type { CommentStatus, IAdminComment, IDeleteImpact } from '@/types/comment'
import type { IPaginationMeta } from '@/types/post'
import { useLayoutStore } from '@/stores/useLayoutStore'

/** 管理端评论查询、审核和事务删除协调。 */
export function useCommentList() {
  const layout = useLayoutStore()
  const comments = ref<IAdminComment[]>([])
  const pagination = shallowRef<IPaginationMeta>()
  const page = shallowRef(1)
  const status = shallowRef<CommentStatus>()
  const error = shallowRef<Error>()
  const deleteTarget = shallowRef<IAdminComment>()
  const deleteImpact = shallowRef<IDeleteImpact>()

  const { send: requestList, loading } = useRequest(
    () => getAdminComments({ page: page.value, limit: 20, status: status.value }),
    { immediate: false },
  )
  const { send: requestModerate, loading: moderating } = useRequest(
    (id: number, next: 'approved' | 'rejected') => moderateComment(id, next),
    { immediate: false },
  )
  const { send: requestImpact, loading: impactLoading } = useRequest(
    (id: number) => getCommentDeleteImpact(id),
    { immediate: false },
  )
  const { send: requestDelete, loading: deleting } = useRequest((id: number) => deleteComment(id), {
    immediate: false,
  })

  async function load(): Promise<void> {
    error.value = undefined
    try {
      const result = await requestList()
      comments.value = result.items
      pagination.value = result.meta
    } catch (reason) {
      error.value = reason instanceof Error ? reason : new Error('评论加载失败')
    }
  }

  async function setStatus(next?: CommentStatus): Promise<void> {
    status.value = next
    page.value = 1
    await load()
  }

  async function setPage(next: number): Promise<void> {
    page.value = next
    await load()
  }

  async function moderate(id: number, next: 'approved' | 'rejected'): Promise<void> {
    try {
      await requestModerate(id, next)
      layout.notify({
        type: 'success',
        title: '评论已处理',
        content: next === 'approved' ? '评论已通过。' : '评论已拒绝。',
      })
      await load()
    } catch (reason) {
      layout.notify({
        type: 'error',
        title: '评论处理失败',
        content: reason instanceof Error ? reason.message : '请稍后重试。',
      })
    }
  }

  async function openDelete(target: IAdminComment): Promise<void> {
    deleteTarget.value = target
    deleteImpact.value = undefined
    try {
      const impact = await requestImpact(target.id)
      if (deleteTarget.value?.id === target.id) deleteImpact.value = impact
    } catch (reason) {
      deleteTarget.value = undefined
      layout.notify({
        type: 'error',
        title: '无法获取删除影响',
        content: reason instanceof Error ? reason.message : '请稍后重试。',
      })
    }
  }

  function closeDelete(): void {
    deleteTarget.value = undefined
    deleteImpact.value = undefined
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget.value || !deleteImpact.value) return
    const targetId = deleteTarget.value.id
    try {
      const latestImpact = await requestImpact(targetId)
      if (
        latestImpact.descendantCount !== deleteImpact.value.descendantCount ||
        latestImpact.totalCount !== deleteImpact.value.totalCount
      ) {
        deleteImpact.value = latestImpact
        layout.notify({
          type: 'info',
          title: '删除范围已变化',
          content: '已更新最新后代数量，请再次确认。',
        })
        return
      }
      const result = await requestDelete(targetId)
      closeDelete()
      layout.notify({
        type: 'success',
        title: '评论已删除',
        content: `共删除 ${result.deletedCount} 条评论。`,
      })
      await load()
    } catch (reason) {
      layout.notify({
        type: 'error',
        title: '评论删除失败',
        content: reason instanceof Error ? reason.message : '请稍后重试。',
      })
    }
  }

  onMounted(load)
  return {
    comments,
    pagination,
    page,
    status,
    loading,
    moderating,
    error,
    deleteTarget,
    deleteImpact,
    impactLoading,
    deleting,
    load,
    setStatus,
    setPage,
    moderate,
    openDelete,
    closeDelete,
    confirmDelete,
  }
}
