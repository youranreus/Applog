import type {
  IGarminLandingActivityDetail,
  IGarminLandingStats,
  IGarminTodayStatus,
} from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/** 获取公开 Landing 运动快照。 */
export const getGarminStats = () => alovaInstance.Get<IGarminLandingStats | null>('/garmin/stats')

/** 获取公开 Landing 今日健康状态。 */
export const getGarminTodayStatus = () =>
  alovaInstance.Get<IGarminTodayStatus | null>('/garmin/today')

/** 按随机公开标识懒加载活动详情。 */
export const getGarminActivityDetail = (publicId: string) =>
  alovaInstance.Get<IGarminLandingActivityDetail>(
    `/garmin/activities/${encodeURIComponent(publicId)}`,
  )
