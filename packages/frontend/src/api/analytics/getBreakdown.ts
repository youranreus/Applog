import { alovaInstance } from '@/utils/alova';
import type {
  IAnalyticsBreakdownItemDto,
  IQueryAnalyticsBreakdownParams,
} from '@/types/analytics';

/**
 * 获取流量分布（管理员）
 * 接口路径: GET /analytics/breakdown
 * @param params - dimension / days / limit
 * @returns Method，返回分布列表
 */
export const getAnalyticsBreakdown = (params: IQueryAnalyticsBreakdownParams) => {
  return alovaInstance.Get<IAnalyticsBreakdownItemDto[]>(
    '/analytics/breakdown',
    { params },
  );
};
