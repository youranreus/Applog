import { computed } from 'vue'
import type { IGarminActivityView, IProps } from '../types'
import { formatActivityDate, formatDistance, formatDuration, getRouteEndpoints } from '../utils'

/**
 * 派生 Garmin 展示文案和安全路线首尾点。
 * @param props - 只读组件输入
 * @returns 格式化后的摘要与活动行
 */
export function useLandingGarminStatsPresentation(props: IProps) {
  const totalText = computed(() =>
    new Intl.NumberFormat('zh-CN').format(props.stats?.totalActivityCount ?? 0),
  )
  const fetchedAtText = computed(() =>
    props.stats ? formatActivityDate(props.stats.fetchedAt) : '',
  )
  const activities = computed<IGarminActivityView[]>(() =>
    (props.stats?.activities ?? []).map((activity, index) => {
      const endpoints = activity.route ? getRouteEndpoints(activity.route.pathData) : null
      return {
        key: `${activity.date}-${activity.type}-${index}`,
        typeDisplay: activity.typeDisplay,
        dateText: formatActivityDate(activity.date),
        distanceText: formatDistance(activity.distanceMeters),
        durationText: formatDuration(activity.durationSeconds),
        sourceText: activity.deviceSource ? `Garmin · ${activity.deviceSource}` : 'Garmin',
        route: activity.route && endpoints ? { ...activity.route, endpoints } : null,
      }
    }),
  )
  return { totalText, fetchedAtText, activities }
}
