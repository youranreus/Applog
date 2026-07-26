/**
 * 站点流量摘要（今日 + 近 7 日，Umami pageviews / visitors）
 */
export interface IAnalyticsSummaryDto {
  todayViews: number;
  todayVisitors: number;
  last7DaysViews: number;
  last7DaysVisitors: number;
}

/**
 * 公开当前在线人数；null 表示 Umami 未配置或暂时不可用。
 */
export interface IAnalyticsActiveDto {
  visitors: number | null;
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
 * 热门页面单项（单栏 path Top）
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
