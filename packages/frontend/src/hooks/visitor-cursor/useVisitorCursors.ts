import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRequest } from 'alova/client'
import { useRoute } from 'vue-router'
import {
  VISITOR_CURSOR_SYNC_INTERVAL_MS,
  type IVisitorCursorIdentity,
  type IVisitorCursorPosition,
  type IVisitorCursorResponse,
} from '@applog/common'
import { syncVisitorCursor } from '@/api/visitor-cursor'
import { ROUTE_NAMES } from '@/constants/permission'
import { claimVisitorCursorIdentity } from '@/utils/visitor-cursor-identity'

interface IVisibleVisitorCursor extends IVisitorCursorResponse {
  expiresAt: number
}

const VISITOR_CURSOR_ROUTE_NAMES = new Set<string>([
  ROUTE_NAMES.LANDING,
  ROUTE_NAMES.POST_LIST,
  ROUTE_NAMES.POST_DETAIL,
  ROUTE_NAMES.PAGE_DETAIL,
])

/**
 * 全局访客鼠标同步生命周期。
 * @returns 当前页面上的其他访客鼠标
 */
export function useVisitorCursors() {
  const route = useRoute()
  const identity = ref<IVisitorCursorIdentity | null>(null)
  const cursors = ref<IVisibleVisitorCursor[]>([])
  const latestPosition = ref<IVisitorCursorPosition | null>(null)

  const pagePath = computed(() => route.path)
  const isEnabled = computed(() => {
    return typeof route.name === 'string' && VISITOR_CURSOR_ROUTE_NAMES.has(route.name)
  })

  const { send: sendSyncRequest } = useRequest(
    () => {
      if (!identity.value || !latestPosition.value) {
        throw new Error('访客身份或鼠标位置尚未就绪')
      }
      return syncVisitorCursor({
        ...identity.value,
        ...latestPosition.value,
        pagePath: pagePath.value,
      })
    },
    { immediate: false },
  )

  let syncTimer: ReturnType<typeof setInterval> | null = null
  let scheduledSyncTimer: ReturnType<typeof setTimeout> | null = null
  let cursorExpiryTimer: ReturnType<typeof setTimeout> | null = null
  let releaseIdentity: (() => void) | null = null
  let isMounted = false
  let isSyncing = false
  let isSyncQueued = false
  let lastSyncStartedAt = Number.NEGATIVE_INFINITY

  function pruneExpiredCursors(): void {
    const now = Date.now()
    cursors.value = cursors.value.filter((cursor) => cursor.expiresAt > now)
    if (cursorExpiryTimer) {
      clearTimeout(cursorExpiryTimer)
      cursorExpiryTimer = null
    }
    const nextExpiry = Math.min(...cursors.value.map((cursor) => cursor.expiresAt))
    if (Number.isFinite(nextExpiry)) {
      cursorExpiryTimer = setTimeout(pruneExpiredCursors, Math.max(0, nextExpiry - now) + 1)
    }
  }

  function scheduleSync(delayMs: number): void {
    if (scheduledSyncTimer) {
      return
    }
    scheduledSyncTimer = setTimeout(() => {
      scheduledSyncTimer = null
      void sync()
    }, delayMs)
  }

  async function sync(): Promise<void> {
    pruneExpiredCursors()
    if (!isEnabled.value || document.hidden || !identity.value || !latestPosition.value) {
      return
    }

    const untilNextSync = lastSyncStartedAt + VISITOR_CURSOR_SYNC_INTERVAL_MS - Date.now()
    if (untilNextSync > 0) {
      scheduleSync(untilNextSync)
      return
    }
    if (isSyncing) {
      isSyncQueued = true
      return
    }

    const requestedPath = pagePath.value
    lastSyncStartedAt = Date.now()
    const requestStartedAt = lastSyncStartedAt
    isSyncing = true
    try {
      const response = await sendSyncRequest()
      if (isEnabled.value && pagePath.value === requestedPath) {
        const receivedAt = Date.now()
        const requestDuration = receivedAt - requestStartedAt
        cursors.value = response.map((cursor) => ({
          ...cursor,
          expiresAt: receivedAt + Math.max(0, cursor.expiresInMs - requestDuration),
        }))
        pruneExpiredCursors()
      }
    } catch {
      // 氛围功能软降级，不用全局通知打断阅读。
    } finally {
      isSyncing = false
      if (isSyncQueued) {
        isSyncQueued = false
        void sync()
      }
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!isEnabled.value || document.hidden) {
      return
    }

    const documentRoot = document.documentElement
    const width = Math.max(documentRoot.scrollWidth, window.innerWidth, 1)
    const height = Math.max(documentRoot.scrollHeight, window.innerHeight, 1)
    latestPosition.value = {
      x: Math.min(1, Math.max(0, (event.clientX + window.scrollX) / width)),
      y: Math.min(1, Math.max(0, (event.clientY + window.scrollY) / height)),
    }
  }

  function stopSync(): void {
    window.removeEventListener('mousemove', handleMouseMove)
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
    if (scheduledSyncTimer) {
      clearTimeout(scheduledSyncTimer)
      scheduledSyncTimer = null
    }
    if (cursorExpiryTimer) {
      clearTimeout(cursorExpiryTimer)
      cursorExpiryTimer = null
    }
  }

  function startSync(): void {
    stopSync()
    if (!isMounted || !isEnabled.value || document.hidden || !identity.value) {
      return
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    syncTimer = setInterval(() => {
      void sync()
    }, VISITOR_CURSOR_SYNC_INTERVAL_MS)
    void sync()
  }

  function refreshLifecycle(): void {
    cursors.value = []
    if (isEnabled.value && !document.hidden) {
      startSync()
      return
    }
    stopSync()
  }

  function handleVisibilityChange(): void {
    refreshLifecycle()
  }

  watch([isEnabled, pagePath], () => {
    if (isMounted) {
      refreshLifecycle()
    }
  })

  onMounted(async () => {
    isMounted = true
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const claim = await claimVisitorCursorIdentity()
    if (!isMounted) {
      claim.release()
      return
    }
    identity.value = claim.identity
    releaseIdentity = claim.release
    refreshLifecycle()
  })

  onUnmounted(() => {
    isMounted = false
    stopSync()
    releaseIdentity?.()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    cursors,
  }
}
