/**
 * 统计内容类型
 */
export type AnalyticsContentType = 'post' | 'page';

/**
 * 上报浏览请求体
 */
export interface IReportViewParams {
  visitorId: string;
  contentType: AnalyticsContentType;
  contentId: number;
}

/**
 * 站点流量摘要
 */
export interface IAnalyticsSummaryDto {
  todayPv: number;
  todayUv: number;
  last7DaysPv: number;
  last7DaysUv: number;
}

/**
 * 趋势日序列单点
 */
export interface IAnalyticsTrendPointDto {
  date: string;
  pv: number;
  uv: number;
}

/**
 * Top 榜单项
 */
export interface IAnalyticsTopItemDto {
  contentType: AnalyticsContentType;
  contentId: number;
  title: string;
  slug: string;
  pv: number;
  uv: number;
}

/**
 * Top 查询参数
 */
export interface IQueryAnalyticsTopParams {
  type: AnalyticsContentType;
  days?: number;
  limit?: number;
}

/**
 * 趋势查询参数
 */
export interface IQueryAnalyticsTrendParams {
  days?: number;
}
