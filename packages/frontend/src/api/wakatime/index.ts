import type { IWakaTimeConfig, IWakaTimeLandingStats } from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/** 获取公开 Landing WakaTime 快照。 */
export const getWakaTimeStats = () =>
  alovaInstance.Get<IWakaTimeLandingStats | null>('/wakatime/stats')

/** 管理员读取脱敏 WakaTime 配置。 */
export const getWakaTimeConfig = () => alovaInstance.Get<IWakaTimeConfig>('/wakatime/config')

/** 管理员保存 WakaTime 配置。 */
export const setWakaTimeConfig = (payload: IWakaTimeConfig) =>
  alovaInstance.Put<IWakaTimeConfig>('/wakatime/config', payload)
