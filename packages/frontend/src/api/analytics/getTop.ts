import { alovaInstance } from '@/utils/alova';
import type {
  IAnalyticsTopItemDto,
  IQueryAnalyticsTopParams,
} from '@/types/analytics';

/**
 * 获取热门页面 Top（管理员）
 * 接口路径: GET /analytics/top
 * @param params - days / limit
 * @returns Method，返回 Top 列表
 */
export const getAnalyticsTop = (params?: IQueryAnalyticsTopParams) => {
  return alovaInstance.Get<IAnalyticsTopItemDto[]>('/analytics/top', {
    params,
  });
};
