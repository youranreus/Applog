import { alovaInstance } from '@/utils/alova';
import type {
  IAnalyticsTopItemDto,
  IQueryAnalyticsTopParams,
} from '@/types/analytics';

/**
 * 获取内容 Top 榜（管理员）
 * 接口路径: GET /analytics/top
 * @param params - type / days / limit
 * @returns Method，返回 Top 列表
 */
export const getAnalyticsTop = (params: IQueryAnalyticsTopParams) => {
  return alovaInstance.Get<IAnalyticsTopItemDto[]>('/analytics/top', {
    params,
  });
};
