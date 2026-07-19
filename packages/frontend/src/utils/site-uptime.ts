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
 * 将建站日期字符串解析为本地零点时间戳
 * @param siteFoundedDate - ISO 日期 `YYYY-MM-DD`
 * @returns 有效则返回毫秒时间戳，否则返回 null
 *
 * 逻辑说明：
 * 1. 校验非空且匹配 YYYY-MM-DD
 * 2. 用 `T00:00:00` 拼成本地午夜，避免 UTC 偏移
 * 3. 无效 Date 返回 null
 */
export function parseSiteFoundedTimestamp(siteFoundedDate: string): number | null {
  const trimmed = siteFoundedDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const timestamp = new Date(`${trimmed}T00:00:00`).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
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
 * 格式化为页脚运行时间文案
 * @param parts - 时长分段
 * @returns `本站已运行 X 天 Y 时 Z 分 W 秒`
 */
export function formatSiteUptimeText(parts: ISiteUptimeParts): string {
  return `本站已运行 ${parts.days} 天 ${parts.hours} 时 ${parts.minutes} 分 ${parts.seconds} 秒`;
}

/**
 * 由建站日期与当前时间生成页脚运行时间文案
 * @param siteFoundedDate - ISO 日期或空
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
