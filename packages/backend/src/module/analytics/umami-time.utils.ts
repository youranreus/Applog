import { ANALYTICS_TIMEZONE } from './analytics.constants';

/**
 * 获取 Asia/Shanghai 日历日字符串 YYYY-MM-DD
 * @param date - 参考时间，默认当前
 * @returns 上海日历日
 */
export function getShanghaiDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * 生成以 endDate 为终点、向过去共 days 天的升序日期列表
 * @param endDate - 结束日（含），YYYY-MM-DD
 * @param days - 天数
 * @returns 升序日期数组
 */
export function buildShanghaiDateRange(
  endDate: string,
  days: number,
): string[] {
  const dates: string[] = [];
  const end = new Date(`${endDate}T12:00:00+08:00`);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(getShanghaiDateString(d));
  }
  return dates;
}

/**
 * 时间窗口：上海日历日起止时间戳（毫秒，含端点）
 */
export interface IShanghaiTimeWindow {
  startAt: number;
  endAt: number;
  startDate: string;
  endDate: string;
}

/**
 * 计算「以今日为终点、向过去共 days 天」的上海时区毫秒窗口
 * @param days - 天数（含今日）
 * @param now - 参考时刻
 * @returns startAt / endAt（ms）与起止日期
 */
export function getShanghaiDaysWindow(
  days: number,
  now: Date = new Date(),
): IShanghaiTimeWindow {
  const endDate = getShanghaiDateString(now);
  const dates = buildShanghaiDateRange(endDate, days);
  const startDate = dates[0];
  const startAt = new Date(`${startDate}T00:00:00+08:00`).getTime();
  const endAt = new Date(`${endDate}T23:59:59.999+08:00`).getTime();
  return { startAt, endAt, startDate, endDate };
}
