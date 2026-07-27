import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'
import { useRequest } from 'alova/client'
import { useRoute } from 'vue-router'
import {
  createComment,
  getCommentLocation,
  getPublicComments,
  resolvePendingComments,
  withdrawComment,
} from '@/api/comment'
import type {
  ICommentSubmission,
  ICommentTarget,
  ICreateComment,
  IPendingCapability,
  IPublicComment,
} from '@/types/comment'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { readPendingCapabilities, writePendingCapabilities } from '../utils/pending-comment-storage'
import { mergeOwnedPendingComments, parseCommentHash } from '../utils/comment-tree'
import { getCommentSubmissionOutcome } from '../utils/comment-submission'

/**
 * 通用评论区的数据、分页、回复与游客待审核 capability 协调。
 * @param target 已发布文章或页面目标
 * @returns 只读状态与显式操作
 */
export function useComments(targetInput: MaybeRefOrGetter<ICommentTarget>) {
  const layoutStore = useLayoutStore()
  const route = useRoute()
  const target = computed(() => toValue(targetInput))
  const page = shallowRef(1)
  const comments = ref<IPublicComment[]>([])
  const pendingComments = ref<IPublicComment[]>([])
  const pagination = shallowRef<{ currentPage: number; totalPages: number; totalItems: number }>()
  const replyTarget = shallowRef<IPublicComment>()
  const activeError = shallowRef<Error>()

  const { send: requestList, loading } = useRequest(
    (nextPage: number) => getPublicComments(target.value, nextPage),
    { immediate: false },
  )
  const { send: requestCreate, loading: submitting } = useRequest(
    (payload: ICreateComment) => createComment(payload),
    { immediate: false },
  )
  const { send: requestResolve } = useRequest(
    (items: IPendingCapability[]) => resolvePendingComments(items),
    { immediate: false },
  )
  const { send: requestWithdraw, loading: withdrawing } = useRequest(
    (id: number, token: string) => withdrawComment(id, token),
    { immediate: false },
  )
  const { send: requestLocation } = useRequest(
    (commentId: number) => getCommentLocation(commentId),
    { immediate: false },
  )

  const capabilities = ref<IPendingCapability[]>(readPendingCapabilities(target.value))
  const canPrevious = computed(() => page.value > 1)
  const canNext = computed(() => page.value < (pagination.value?.totalPages ?? 1))
  const visibleComments = computed(() =>
    mergeOwnedPendingComments(comments.value, pendingComments.value, page.value === 1),
  )
  const withdrawableIds = computed(() => capabilities.value.map((item) => item.commentId))
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let targetVersion = 0

  const targetIdentity = (value: ICommentTarget): string => `${value.type}:${value.id}`

  async function focusHashTarget(commentId: number): Promise<boolean> {
    await nextTick()
    const element = document.getElementById(`comment-${commentId}`)
    if (!element) return false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    element.focus({ preventScroll: true })
    element.classList.add('is-comment-target')
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => element.classList.remove('is-comment-target'), 1800)
    return true
  }

  async function loadHashTarget(hash: string): Promise<boolean> {
    const commentId = parseCommentHash(hash)
    if (!commentId) return false
    try {
      const location = await requestLocation(commentId)
      page.value = location.page
      await load(false, false)
      if (!(await focusHashTarget(commentId))) {
        page.value = 1
        await load(false, false)
      }
      return true
    } catch {
      return false
    }
  }

  async function load(
    resolveHash = true,
    revealPendingContext = true,
    refreshOwnedPending = true,
  ): Promise<void> {
    if (resolveHash && (await loadHashTarget(route.hash))) return
    const version = targetVersion
    activeError.value = undefined
    try {
      const result = await requestList(page.value)
      if (version !== targetVersion) return
      comments.value = result.items
      pagination.value = result.meta
      if (refreshOwnedPending) await resolveOwnedPending()
      if (revealPendingContext) await revealLatestPendingReplyParent()
    } catch (error) {
      activeError.value = error instanceof Error ? error : new Error('评论加载失败')
    }
  }

  async function revealLatestPendingReplyParent(): Promise<void> {
    const loadedIds = new Set<number>()
    const collectIds = (items: IPublicComment[]) => {
      for (const item of items) {
        loadedIds.add(item.id)
        collectIds(item.replies ?? [])
      }
    }
    collectIds(comments.value)
    const pendingReply = [...pendingComments.value]
      .sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .find((item) => item.parentId && !loadedIds.has(item.parentId))
    if (!pendingReply?.parentId) return
    try {
      const location = await requestLocation(pendingReply.parentId)
      if (location.page === page.value) return
      page.value = location.page
      await load(false, false)
    } catch {
      // Parent is not publicly locatable; do not reveal any hidden-state distinction.
    }
  }

  async function resolveOwnedPending(): Promise<void> {
    if (!capabilities.value.length) {
      pendingComments.value = []
      return
    }
    try {
      const currentTarget = target.value
      const currentIdentity = targetIdentity(currentTarget)
      const resolved = (await requestResolve(capabilities.value)).filter(
        (item) =>
          (currentTarget.type === 'post' &&
            item.postId === currentTarget.id &&
            !item.pageId) ||
          (currentTarget.type === 'page' &&
            item.pageId === currentTarget.id &&
            !item.postId),
      )
      if (currentIdentity !== targetIdentity(target.value)) return
      const validIds = new Set(resolved.map((item) => item.id))
      capabilities.value = capabilities.value.filter((item) => validIds.has(item.commentId))
      writePendingCapabilities(currentTarget, capabilities.value)
      pendingComments.value = resolved
    } catch {
      pendingComments.value = []
    }
  }

  async function submit(payload: ICommentSubmission): Promise<void> {
    try {
      const submittedAsRoot = !replyTarget.value
      const currentTarget = target.value
      const targetPayload =
        currentTarget.type === 'post'
          ? { postId: currentTarget.id }
          : { pageId: currentTarget.id }
      const result = await requestCreate({
        ...payload,
        ...targetPayload,
        parentId: replyTarget.value?.id,
      })
      if (targetIdentity(currentTarget) !== targetIdentity(target.value)) {
        if (result.withdrawToken) {
          const prior = readPendingCapabilities(currentTarget)
          writePendingCapabilities(
            currentTarget,
            [
              ...prior.filter((item) => item.commentId !== result.comment.id),
              { commentId: result.comment.id, token: result.withdrawToken },
            ].slice(-20),
          )
        }
        return
      }
      const outcome = getCommentSubmissionOutcome(result, submittedAsRoot)
      replyTarget.value = undefined

      if (outcome.kind === 'approved') {
        if (outcome.resetToFirstPage) page.value = 1
        await load(false, false, false)
        await focusHashTarget(result.comment.id)
        layoutStore.notify({ type: 'success', title: '评论已发布', content: '评论已公开。' })
        return
      }

      if (outcome.capability) {
        capabilities.value = [
          ...capabilities.value.filter((item) => item.commentId !== result.comment.id),
          outcome.capability,
        ].slice(-20)
        writePendingCapabilities(currentTarget, capabilities.value)
      }
      pendingComments.value = [...pendingComments.value, result.comment]
      if (submittedAsRoot && page.value !== 1) {
        page.value = 1
        await load(false, false)
      }
      layoutStore.notify({ type: 'success', title: '评论已提交', content: '正在等待审核。' })
    } catch (error) {
      layoutStore.notify({
        type: 'error',
        title: '评论提交失败',
        content: error instanceof Error ? error.message : '请稍后重试。',
      })
    }
  }

  async function withdraw(commentId: number): Promise<void> {
    const capability = capabilities.value.find((item) => item.commentId === commentId)
    if (!capability) return
    const currentTarget = target.value
    const currentIdentity = targetIdentity(currentTarget)
    try {
      await requestWithdraw(commentId, capability.token)
      if (currentIdentity !== targetIdentity(target.value)) {
        writePendingCapabilities(
          currentTarget,
          readPendingCapabilities(currentTarget).filter((item) => item.commentId !== commentId),
        )
        return
      }
      capabilities.value = capabilities.value.filter((item) => item.commentId !== commentId)
      pendingComments.value = pendingComments.value.filter((item) => item.id !== commentId)
      writePendingCapabilities(currentTarget, capabilities.value)
      layoutStore.notify({
        type: 'success',
        title: '评论已撤回',
        content: '该条待审核评论已删除。',
      })
    } catch (error) {
      layoutStore.notify({
        type: 'error',
        title: '撤回失败',
        content: error instanceof Error ? error.message : '请稍后重试。',
      })
    }
  }

  async function setPage(next: number): Promise<void> {
    if (next < 1 || next === page.value) return
    page.value = next
    await load(false, false)
  }

  onMounted(() => load())
  watch(
    () => route.hash,
    (hash, previousHash) => {
      if (hash !== previousHash) void loadHashTarget(hash)
    },
  )
  watch(
    () => targetIdentity(target.value),
    () => {
      targetVersion++
      page.value = 1
      comments.value = []
      pendingComments.value = []
      pagination.value = undefined
      replyTarget.value = undefined
      activeError.value = undefined
      capabilities.value = readPendingCapabilities(target.value)
      void load()
    },
  )
  onBeforeUnmount(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
  })
  return {
    comments: visibleComments,
    pagination,
    page,
    loading,
    submitting,
    withdrawing,
    error: activeError,
    replyTarget,
    canPrevious,
    canNext,
    withdrawableIds,
    load,
    submit,
    withdraw,
    setPage,
    canWithdraw: (commentId: number) =>
      capabilities.value.some((item) => item.commentId === commentId),
    setReplyTarget: (comment?: IPublicComment) => {
      replyTarget.value = comment
    },
  }
}

/** Backward-compatible article-only entry point. */
export function usePostComments(postId: number) {
  return useComments({ type: 'post', id: postId })
}
