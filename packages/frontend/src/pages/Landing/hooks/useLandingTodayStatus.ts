import { computed } from 'vue'
import { useRequest } from 'alova/client'
import { getGarminTodayStatus } from '@/api/garmin'

/**
 * Independently load today's allowlisted Garmin health projection.
 * @returns Today status, request state, and a soft unavailable flag
 */
export function useLandingTodayStatus() {
  const { data, loading, error } = useRequest(getGarminTodayStatus, { immediate: true })
  return {
    status: computed(() => data.value ?? null),
    loading,
    unavailable: computed(() => Boolean(error.value)),
  }
}
