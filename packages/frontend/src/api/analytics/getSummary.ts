import { alovaInstance } from '@/utils/alova';
import type { IAnalyticsSummaryDto } from '@/types/analytics';

/**
 * 获取站点流量摘要（管理员）
 * 接口路径: GET /analytics/summary
 * @returns Method，返回今日与近 7 日 PV/UV
 */
export const getAnalyticsSummary = () => {
  return alovaInstance.Get<IAnalyticsSummaryDto>('/analytics/summary');
};
