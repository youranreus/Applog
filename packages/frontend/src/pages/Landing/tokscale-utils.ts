import type { ITokscaleLandingStats } from '@applog/common'

export const TOKSCALE_TOKEN_SEGMENTS = [
  { key: 'input', label: 'Input', color: '#1d1d1f' },
  { key: 'output', label: 'Output', color: '#4a4f55' },
  { key: 'cacheRead', label: 'Cache Read', color: '#70757b' },
  { key: 'cacheWrite', label: 'Cache Write', color: '#989ea5' },
  { key: 'reasoning', label: 'Reasoning', color: '#c3c8ce' },
] as const

function parseYmd(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? parsed
    : null
}

/** 25901073 -> "25.9M"；1234 -> "1.2K"；0 -> "0"。 */
export function formatTokenCount(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0
  const units = [
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ]
  const unit = units.find((item) => safe >= item.threshold)
  if (!unit) return String(Math.round(safe))
  const formatted = (safe / unit.threshold).toFixed(1).replace(/\.0$/, '')
  return `${formatted}${unit.suffix}`
}

/** 10.719 -> "$10.72"；0.0047 -> "<$0.01"；0 -> "$0.00"。 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** "2026-09-02" 相对 today 渲染为「今天」/「昨天」/「9月2日」。 */
export function formatTokscaleDay(date: string, today: string): string {
  const target = parseYmd(date)
  const current = parseYmd(today)
  if (!target || !current) return date
  const diffDays = Math.round((current.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return `${target.getUTCMonth() + 1}月${target.getUTCDate()}日`
}

/** date 距 today 超过 3 天则为 true。 */
export function isTokscaleDataDelayed(date: string, today: string): boolean {
  const target = parseYmd(date)
  const current = parseYmd(today)
  if (!target || !current) return false
  return (current.getTime() - target.getTime()) / 86_400_000 > 3
}

/** 五项 token 的占比；总量为 0 时全部返回 0。 */
export function getTokscaleTokenShares(tokens: ITokscaleLandingStats['tokens']): number[] {
  const values = TOKSCALE_TOKEN_SEGMENTS.map((segment) => tokens[segment.key])
  const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
  return values.map((value) => (total > 0 && Number.isFinite(value) ? value / total : 0))
}

export function getBrowserYmd(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
