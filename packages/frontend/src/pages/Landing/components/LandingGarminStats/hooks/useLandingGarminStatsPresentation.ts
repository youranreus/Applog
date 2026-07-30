import { computed } from 'vue'
import type { IGarminActivityView, IProps } from '../types'
import {
  formatActivityDate,
  formatCalories,
  formatDistance,
  formatDuration,
  getGarminCardMetrics,
  getRouteEndpoints,
} from '../utils'

/**
 * 派生 Garmin 展示文案和安全路线首尾点。
 * @param props - 只读组件输入
 * @returns 格式化后的摘要与活动卡片视图模型
 *
 * 逻辑说明：
 * 1. 汇总次数与同步时间文案
 * 2. 将可选距离/地点/消耗规范为 null，供模板省略；椭圆机始终隐藏距离
 * 3. 仅在 path 可解析时保留 GPS 封面
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
      const locationText =
        typeof activity.locationName === 'string' && activity.locationName.trim()
          ? activity.locationName.trim()
          : null
      const hideDistance = activity.type === 'elliptical'
      return {
        key: activity.publicId || `${activity.date}-${activity.type}-${index}`,
        publicId: activity.publicId,
        type: activity.type,
        typeDisplay: activity.typeDisplay,
        dateText: formatActivityDate(activity.date),
        locationText,
        distanceText: hideDistance ? null : formatDistance(activity.distanceMeters ?? null),
        caloriesText: formatCalories(activity.calories ?? null),
        durationText: formatDuration(activity.durationSeconds),
        cardMetrics: getGarminCardMetrics(activity),
        cover: activity.cover,
        summary: activity,
        route: activity.route && endpoints ? { ...activity.route, endpoints } : null,
      }
    }),
  )
  return { totalText, fetchedAtText, activities }
}
