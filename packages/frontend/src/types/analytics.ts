/**
 * 站点流量摘要（Umami Views / Visitors）
 */
export interface IAnalyticsSummaryDto {
  todayViews: number;
  todayVisitors: number;
  last7DaysViews: number;
  last7DaysVisitors: number;
}

/**
 * 趋势日序列单点
 */
export interface IAnalyticsTrendPointDto {
  date: string;
  views: number;
  visitors: number;
}

/**
 * 热门页面单项
 */
export interface IAnalyticsTopItemDto {
  path: string;
  title: string;
  views: number;
  href: string;
}

/**
 * 设备 / OS / 地域分布单项
 */
export interface IAnalyticsBreakdownItemDto {
  name: string;
  value: number;
}

/**
 * Breakdown 维度
 */
export type AnalyticsBreakdownDimension = 'os' | 'device' | 'country';

/**
 * Top 查询参数
 */
export interface IQueryAnalyticsTopParams {
  days?: number;
  limit?: number;
}

/**
 * 趋势查询参数
 */
export interface IQueryAnalyticsTrendParams {
  days?: number;
}

/**
 * Breakdown 查询参数
 */
export interface IQueryAnalyticsBreakdownParams {
  dimension: AnalyticsBreakdownDimension;
  days?: number;
  limit?: number;
}

/**
 * 公开 Tracker 引导
 */
export interface IAnalyticsTrackerConfigDto {
  enabled: boolean;
  scriptUrl: string;
  websiteId: string;
}
