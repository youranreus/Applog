import { computed } from 'vue'
import { useRequest } from 'alova/client'
import { getGarminStats } from '@/api/garmin'

/**
 * 独立读取 Landing Garmin 快照。
 * 请求失败或首次尚未同步时折叠为 null，不影响页面其他区块。
 * @returns 公开快照、加载状态与不可用状态
 */
export function useLandingGarminStats() {
  const { data, loading, error } = useRequest(getGarminStats, {
    immediate: true,
  })
  return {
    stats: computed(() => data.value ?? null),
    loading,
    unavailable: computed(() => Boolean(error.value)),
  }
}
