import { alovaInstance } from '@/utils/alova';
import type {
  IAnalyticsTrendPointDto,
  IQueryAnalyticsTrendParams,
} from '@/types/analytics';

/**
 * 获取站点日趋势（管理员）
 * 接口路径: GET /analytics/trend
 * @param params - days 可选，默认后端 30
 * @returns Method，返回日序列
 */
export const getAnalyticsTrend = (params?: IQueryAnalyticsTrendParams) => {
  return alovaInstance.Get<IAnalyticsTrendPointDto[]>('/analytics/trend', {
    params,
  });
};
