import type { AnalyticsContentType } from '@/entities';

/**
 * 站点流量摘要（今日 + 近 7 日）
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
