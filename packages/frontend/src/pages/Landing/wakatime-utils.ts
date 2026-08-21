export function formatCompactToken(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatWakaTimeDateRange(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return `${startDate} – ${endDate}`
  }
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

/** 汇总已上报的 token；三项都缺失时保持 null。 */
export function sumKnownTokens(values: readonly (number | null)[]): number | null {
  const knownValues = values.filter((value): value is number => value !== null)
  return knownValues.length ? knownValues.reduce((sum, value) => sum + value, 0) : null
}

/** 缺失项保持 null；已上报的全零项明确返回 0，避免与未知混淆。 */
export function getWakaTimeTokenShares(values: readonly (number | null)[]): Array<number | null> {
  const total = sumKnownTokens(values)
  return values.map((value) => {
    if (value === null) return null
    return total !== null && total > 0 ? value / total : 0
  })
}

/** null 与真实 0 分开，避免把未上报误说成免费。 */
export function formatEstimatedUsd(value: number | null): string | null {
  if (value === null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  }).format(value)
}

export function sortWakaTimeUsageItems<T extends { name: string; share: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => right.share - left.share)
}

/** 把用量占比压缩到克制且可分辨的 tag 色深范围。 */
export function getWakaTimeTagTint(share: number): number {
  const normalized = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0))
  return Math.round(8 + normalized * 20)
}
