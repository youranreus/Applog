import type { IGarminLandingActivityDetail, IGarminLandingStats } from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/** 获取公开 Landing 运动快照。 */
export const getGarminStats = () => alovaInstance.Get<IGarminLandingStats | null>('/garmin/stats')

/** 按随机公开标识懒加载活动详情。 */
export const getGarminActivityDetail = (publicId: string) =>
  alovaInstance.Get<IGarminLandingActivityDetail>(
    `/garmin/activities/${encodeURIComponent(publicId)}`,
  )
