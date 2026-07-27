import type {
  IDuolingoConfig,
  IDuolingoLandingStats,
} from '@applog/common';
import { alovaInstance } from '@/utils/alova';

/** 获取公开 Landing 学习统计。 */
export const getDuolingoStats = () =>
  alovaInstance.Get<IDuolingoLandingStats | null>('/duolingo/stats');

/** 管理员读取脱敏 Duolingo 配置。 */
export const getDuolingoConfig = () =>
  alovaInstance.Get<IDuolingoConfig>('/duolingo/config');

/** 管理员保存 Duolingo 配置。 */
export const setDuolingoConfig = (payload: IDuolingoConfig) =>
  alovaInstance.Put<IDuolingoConfig>('/duolingo/config', payload);
