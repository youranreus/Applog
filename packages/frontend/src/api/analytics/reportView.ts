import { alovaInstance } from '@/utils/alova';
import type { IReportViewParams } from '@/types/analytics';

/**
 * 上报内容浏览事件（公开接口，失败由调用方静默处理）
 * 接口路径: POST /analytics/view
 * @param params - visitorId / contentType / contentId
 * @returns Method，响应 data 为空对象
 */
export const reportAnalyticsView = (params: IReportViewParams) => {
  return alovaInstance.Post<Record<string, never>>('/analytics/view', params);
};
