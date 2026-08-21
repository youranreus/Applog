import { computed } from 'vue'
import { useRequest } from 'alova/client'
import { getWakaTimeStats } from '@/api/wakatime'

/**
 * 独立读取 Landing WakaTime 快照；失败不影响其他 Landing 区块。
 * @returns 公开快照、加载状态和不可用状态
 */
export function useLandingWakaTimeStats() {
  const { data, loading, error } = useRequest(getWakaTimeStats, {
    immediate: true,
  })
  return {
    stats: computed(() => data.value ?? null),
    loading,
    unavailable: computed(() => Boolean(error.value)),
  }
}
