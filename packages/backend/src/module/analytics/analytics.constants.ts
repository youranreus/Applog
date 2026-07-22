/**
 * Analytics 模块常量
 */

/** 站点级 scopeId 哨兵值 */
export const ANALYTICS_SITE_SCOPE_ID = 0;

/** PV 去抖窗口（毫秒）：30 分钟 */
export const ANALYTICS_DEBOUNCE_MS = 30 * 60 * 1000;

/** 日 UV 去重行建议保留天数（清理用，MVP 可手动调用） */
export const ANALYTICS_VISITOR_RETENTION_DAYS = 90;

/** 默认趋势天数 */
export const ANALYTICS_DEFAULT_TREND_DAYS = 30;

/** 默认 Top 数量 */
export const ANALYTICS_DEFAULT_TOP_LIMIT = 10;

/** 摘要「近 N 日」天数（含今日） */
export const ANALYTICS_SUMMARY_DAYS = 7;

/** 切日时区 */
export const ANALYTICS_TIMEZONE = 'Asia/Shanghai';
