import type { IGarminLandingActivity, IGarminLandingActivityDetail } from '@applog/common'
import type { IGarminMetricGroups, IGarminMetricView, IRouteEndpoints } from './types'

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

/**
 * 格式化活动距离；无可靠距离时返回 null，由 UI 省略该项。
 * @param meters - 距离（米），缺失为 null
 * @returns 展示文案或 null
 */
export function formatDistance(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return null
  return `${(meters / 1000).toFixed(2)} km`
}

/**
 * 格式化消耗热量；无可靠数据时返回 null，由 UI 省略该项。
 * @param calories - 卡路里，缺失为 null
 * @returns 展示文案或 null
 */
export function formatCalories(calories: number | null): string | null {
  if (calories === null || !Number.isFinite(calories) || calories < 0) return null
  return `${Math.round(calories)} kcal`
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

export function formatPace(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null
  return `${formatDuration(seconds)} /km`
}

export function formatSpeed(metersPerSecond: number | null): string | null {
  if (metersPerSecond === null || !Number.isFinite(metersPerSecond) || metersPerSecond < 0) {
    return null
  }
  return `${(metersPerSecond * 3.6).toFixed(1)} km/h`
}

type MetricKey =
  | 'distance'
  | 'duration'
  | 'calories'
  | 'pace'
  | 'averageSpeed'
  | 'maxSpeed'
  | 'averageHeartRate'
  | 'maxHeartRate'
  | 'elevation'
  | 'cadence'
  | 'power'
  | 'trainingEffect'
  | 'bodyBattery'
  | 'laps'

const PRESETS: Record<string, { core: MetricKey[]; secondary: MetricKey[] }> = {
  generic: {
    core: ['duration', 'distance', 'calories'],
    secondary: ['averageHeartRate', 'maxHeartRate'],
  },
  soccer: {
    core: ['duration', 'distance', 'calories'],
    secondary: ['averageHeartRate', 'maxHeartRate', 'maxSpeed', 'trainingEffect'],
  },
  running: {
    core: ['distance', 'duration', 'pace'],
    secondary: [
      'averageHeartRate',
      'maxHeartRate',
      'elevation',
      'cadence',
      'power',
      'trainingEffect',
    ],
  },
  track_running: {
    core: ['distance', 'duration', 'pace', 'laps'],
    secondary: ['averageHeartRate', 'maxHeartRate', 'cadence', 'power'],
  },
  treadmill_running: {
    core: ['distance', 'duration', 'pace'],
    secondary: ['averageHeartRate', 'maxHeartRate', 'cadence', 'power', 'trainingEffect'],
  },
  cycling: {
    core: ['distance', 'duration', 'averageSpeed'],
    secondary: ['maxSpeed', 'averageHeartRate', 'maxHeartRate', 'elevation', 'power', 'cadence'],
  },
  elliptical: {
    core: ['duration', 'calories', 'averageHeartRate'],
    secondary: ['maxHeartRate', 'cadence', 'trainingEffect'],
  },
  indoor_cardio: {
    core: ['duration', 'calories', 'averageHeartRate'],
    secondary: ['maxHeartRate', 'trainingEffect', 'bodyBattery'],
  },
  stair_climbing: {
    core: ['duration', 'calories', 'averageHeartRate'],
    secondary: ['maxHeartRate', 'cadence', 'trainingEffect'],
  },
}

export function getGarminMetricGroups(
  summary: IGarminLandingActivity,
  detail: IGarminLandingActivityDetail | null,
): IGarminMetricGroups {
  const preset = PRESETS[summary.type] ?? PRESETS.generic!
  const values: Record<MetricKey, IGarminMetricView | null> = {
    distance: metric('distance', '距离', formatDistance(summary.distanceMeters)),
    duration: metric('duration', '用时', formatDuration(summary.durationSeconds)),
    calories: metric('calories', '消耗', formatCalories(summary.calories)),
    pace: metric('pace', '平均配速', formatPace(detail?.averagePaceSecondsPerKm ?? null)),
    averageSpeed: metric(
      'averageSpeed',
      '平均速度',
      formatSpeed(detail?.averageSpeedMetersPerSecond ?? null),
    ),
    maxSpeed: metric('maxSpeed', '最高速度', formatSpeed(detail?.maxSpeedMetersPerSecond ?? null)),
    averageHeartRate: numericMetric(
      'averageHeartRate',
      '平均心率',
      detail?.averageHeartRateBpm,
      ' bpm',
    ),
    maxHeartRate: numericMetric('maxHeartRate', '最高心率', detail?.maxHeartRateBpm, ' bpm'),
    elevation: numericMetric('elevation', '累计爬升', detail?.elevationGainMeters, ' m'),
    cadence: numericMetric('cadence', '平均步频', detail?.averageCadencePerMinute, ' /min'),
    power: numericMetric('power', '平均功率', detail?.averagePowerWatts, ' W'),
    trainingEffect: numericMetric('trainingEffect', '训练效果', detail?.trainingEffect, ''),
    bodyBattery: numericMetric('bodyBattery', '身体电量变化', detail?.bodyBatteryDelta, ''),
    laps: numericMetric('laps', '圈数', detail?.lapCount, ''),
  }
  const select = (keys: MetricKey[]) =>
    keys.flatMap((key) => (values[key] ? [values[key]] : [])) as IGarminMetricView[]
  return { core: select(preset.core), secondary: select(preset.secondary) }
}

function metric(key: string, label: string, value: string | null): IGarminMetricView | null {
  return value === null ? null : { key, label, value }
}

function numericMetric(
  key: string,
  label: string,
  value: number | null | undefined,
  suffix: string,
): IGarminMetricView | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return { key, label, value: `${Math.round(value)}${suffix}` }
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
