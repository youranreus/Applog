import { computed } from 'vue';
import { useRequest } from 'alova/client';
import { getDuolingoStats } from '@/api/duolingo';

/**
 * 独立读取 Landing Duolingo 统计。
 * 失败或未配置时均折叠为 null，不影响页面其他请求。
 * @returns 公开统计、加载状态与不可用状态
 */
export function useLandingDuolingoStats() {
  const { data, loading, error } = useRequest(getDuolingoStats, {
    immediate: true,
  });
  return {
    stats: computed(() => data.value ?? null),
    loading,
    unavailable: computed(() => Boolean(error.value)),
  };
}
