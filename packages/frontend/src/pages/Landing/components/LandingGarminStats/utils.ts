import type { IRouteEndpoints } from './types'

const SAFE_ROUTE_PATTERN = /^M \d+(?:\.\d+)? \d+(?:\.\d+)?(?: L \d+(?:\.\d+)? \d+(?:\.\d+)?)+$/

/** 格式化活动日期，按站点部署时区展示。 */
export function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value))
}

/** 格式化活动距离；null 明确表示无可靠距离。 */
export function formatDistance(meters: number | null): string {
  if (meters === null) return '距离暂无'
  return `${(meters / 1000).toFixed(2)} km`
}

/** 格式化活动时长为 H:MM:SS 或 M:SS。 */
export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainder = safeSeconds % 60
  const minuteText = hours ? String(minutes).padStart(2, '0') : String(minutes)
  const core = `${minuteText}:${String(remainder).padStart(2, '0')}`
  return hours ? `${hours}:${core}` : core
}

/** 从 worker 限定的 M/L path 中提取完整路线首尾点。 */
export function getRouteEndpoints(pathData: string): IRouteEndpoints | null {
  if (!SAFE_ROUTE_PATTERN.test(pathData)) return null
  const coordinates = [...pathData.matchAll(/(?:M|L) ([\d.]+) ([\d.]+)/g)]
  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]
  if (!first || !last) return null
  return {
    start: { x: Number(first[1]), y: Number(first[2]) },
    end: { x: Number(last[1]), y: Number(last[2]) },
  }
}
