import { alovaInstance } from '@/utils/alova';
import type { IAnalyticsActiveDto } from '@/types/analytics';

/**
 * 获取 Umami 当前在线人数（公开接口）。
 * @returns Method；visitors 为 null 表示暂时不可用
 */
export const getActiveVisitors = () => {
  return alovaInstance.Get<IAnalyticsActiveDto>('/analytics/active');
};
