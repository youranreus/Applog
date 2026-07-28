import type { IGarminLandingStats } from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/** 获取公开 Landing 运动快照。 */
export const getGarminStats = () => alovaInstance.Get<IGarminLandingStats | null>('/garmin/stats')
