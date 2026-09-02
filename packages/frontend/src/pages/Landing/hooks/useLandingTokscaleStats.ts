import { computed } from 'vue'
import { useRequest } from 'alova/client'
import { getTokscaleStats } from '@/api/tokscale'

/**
 * 独立读取 Landing Tokscale 快照；失败不影响其他 Landing 区块。
 * @returns 公开快照、加载状态和不可用状态
 */
export function useLandingTokscaleStats() {
  const { data, loading, error } = useRequest(getTokscaleStats, {
    immediate: true,
  })
  return {
    stats: computed(() => data.value ?? null),
    loading,
    unavailable: computed(() => Boolean(error.value)),
  }
}
