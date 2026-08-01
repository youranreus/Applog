import type { GarminYesterdaySleepMetric } from '@applog/common'

/** Format a nullable numeric metric without collapsing observed zero. */
export function formatMetric(value: number | null, suffix: string): string {
  return value === null ? '—' : `${Math.round(value)}${suffix}`
}

/** Format the discriminated sleep metric with a truthful duration fallback. */
export function formatSleep(sleep: GarminYesterdaySleepMetric): { label: string; value: string } {
  if (sleep.kind === 'score') return { label: '睡眠评分', value: `${Math.round(sleep.score)} 分` }
  if (sleep.kind === 'duration') {
    const totalMinutes = Math.round(sleep.seconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return { label: '睡眠时长', value: `${hours} 小时 ${minutes} 分` }
  }
  return { label: '睡眠', value: '—' }
}
