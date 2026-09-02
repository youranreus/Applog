import type { ITokscaleLandingStats } from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/** 获取公开 Landing Tokscale 快照。 */
export const getTokscaleStats = () =>
  alovaInstance.Get<ITokscaleLandingStats | null>('/tokscale/stats')
