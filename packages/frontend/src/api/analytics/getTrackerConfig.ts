import { alovaInstance } from '@/utils/alova';
import type { IAnalyticsTrackerConfigDto } from '@/types/analytics';

/**
 * 获取公开 Tracker 引导（无凭证）
 * 接口路径: GET /analytics/tracker-config
 * @returns Method，返回 enabled / scriptUrl / websiteId
 */
export const getAnalyticsTrackerConfig = () => {
  return alovaInstance.Get<IAnalyticsTrackerConfigDto>(
    '/analytics/tracker-config',
  );
};
