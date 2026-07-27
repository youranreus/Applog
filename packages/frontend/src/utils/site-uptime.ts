/**
 * 站点运行时间分段结果
 */
export interface ISiteUptimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * 本地建站时间的解析结果
 */
export interface ISiteFoundedLocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timestamp: number;
}

/**
 * 解析并校验本地建站时间
 * @param siteFoundedDate - 本地时间 `YYYY-MM-DDTHH:mm`，兼容旧的 `YYYY-MM-DD`
 * @returns 有效的日期时间分量与时间戳，否则返回 null
 */
export function parseSiteFoundedLocalTime(siteFoundedDate: string): ISiteFoundedLocalTime | null {
  const trimmed = siteFoundedDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const foundedAt = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    foundedAt.getFullYear() !== year ||
    foundedAt.getMonth() !== month - 1 ||
    foundedAt.getDate() !== day ||
    foundedAt.getHours() !== hour ||
    foundedAt.getMinutes() !== minute
  ) {
    return null;
  }

  return { year, month, day, hour, minute, timestamp: foundedAt.getTime() };
}

/**
 * 将建站时间字符串解析为本地时间戳
 * @param siteFoundedDate - 本地时间 `YYYY-MM-DDTHH:mm`，兼容旧的 `YYYY-MM-DD`
 * @returns 有效则返回毫秒时间戳，否则返回 null
 *
 * 逻辑说明：
 * 1. 旧的纯日期值按本地 00:00 解析
 * 2. 新值保留到分钟，不引入 UTC 偏移
 * 3. 校验日历日与时间分量，拒绝 Date 自动滚动修正的非法值
 */
export function parseSiteFoundedTimestamp(siteFoundedDate: string): number | null {
  return parseSiteFoundedLocalTime(siteFoundedDate)?.timestamp ?? null;
}

/**
 * 根据起算时间与当前时间计算运行时长分段
 * @param foundedAt - 建站本地零点时间戳（毫秒）
 * @param now - 当前时间戳（毫秒）
 * @returns 天/时/分/秒；未来日期钳制为全 0
 *
 * 逻辑说明：
 * 1. 差值取 max(0, now - foundedAt)
 * 2. 依次整除天、时、分、秒
 */
export function calcSiteUptimeParts(foundedAt: number, now: number): ISiteUptimeParts {
  const totalSeconds = Math.max(0, Math.floor((now - foundedAt) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

/**
 * 格式化为站点运行时间文案
 * @param parts - 时长分段
 * @returns `已运行 X 天 Y 时 Z 分 W 秒`
 */
export function formatSiteUptimeText(parts: ISiteUptimeParts): string {
  return `已运行 ${parts.days} 天 ${parts.hours} 时 ${parts.minutes} 分 ${parts.seconds} 秒`;
}

/**
 * 由建站日期与当前时间生成运行时间文案
 * @param siteFoundedDate - 本地建站时间或空
 * @param now - 当前时间戳（毫秒）
 * @returns 可展示文案；无法解析时返回 null
 */
export function getSiteUptimeText(siteFoundedDate: string | undefined, now: number): string | null {
  if (!siteFoundedDate?.trim()) {
    return null;
  }

  const foundedAt = parseSiteFoundedTimestamp(siteFoundedDate);
  if (foundedAt === null) {
    return null;
  }

  return formatSiteUptimeText(calcSiteUptimeParts(foundedAt, now));
}
