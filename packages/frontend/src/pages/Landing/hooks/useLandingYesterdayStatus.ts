import { computed } from 'vue'
import { useRequest } from 'alova/client'
import { getGarminYesterdayStatus } from '@/api/garmin'

/**
 * Independently load yesterday's allowlisted Garmin health projection.
 * @returns Yesterday status, request state, and a soft unavailable flag
 */
export function useLandingYesterdayStatus() {
  const { data, loading, error } = useRequest(getGarminYesterdayStatus, { immediate: true })
  return {
    status: computed(() => data.value ?? null),
    loading,
    unavailable: computed(() => Boolean(error.value)),
  }
}
