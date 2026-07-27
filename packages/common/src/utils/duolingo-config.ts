import { DUOLINGO_JWT_MASK } from '../constants/system-config.js';
import type { IDuolingoConfig } from '../types/system-config.js';

export const DEFAULT_DUOLINGO_TIME_ZONE = 'Asia/Shanghai';

/**
 * 验证 IANA 时区名称。
 * @param timeZone - 待验证的 IANA 时区名称
 * @returns 是否可被 Intl 正确识别
 */
export function isValidIanaTimeZone(timeZone: string): boolean {
  const value = (timeZone || '').trim();
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * 判断服务端是否具备抓取 Duolingo 数据的完整配置。
 * @param config - Duolingo 配置
 * @returns 配置是否启用且用户名、JWT、时区均可用
 */
export function isDuolingoConfigured(
  config: IDuolingoConfig | null | undefined,
): boolean {
  return Boolean(
    config?.enabled &&
      config.username?.trim() &&
      config.jwt?.trim() &&
      isValidIanaTimeZone(config.timeZone),
  );
}

/**
 * 管理端读回时遮盖 JWT。
 * @param config - 服务端完整配置
 * @returns JWT 已脱敏的管理端配置
 */
export function maskDuolingoConfigJwt(
  config: IDuolingoConfig,
): IDuolingoConfig {
  return {
    ...config,
    username: (config.username || '').trim(),
    jwt: config.jwt?.trim() ? DUOLINGO_JWT_MASK : '',
    timeZone: (config.timeZone || '').trim() || DEFAULT_DUOLINGO_TIME_ZONE,
    enabled: config.enabled === true,
  };
}

/**
 * 判断 JWT 表单值是否表示保留现有凭证。
 * @param jwt - 管理端提交的 JWT 草稿
 * @returns 空值或脱敏占位时为 true
 */
export function shouldKeepExistingDuolingoJwt(
  jwt: string | undefined,
): boolean {
  const value = (jwt || '').trim();
  return value === '' || value === DUOLINGO_JWT_MASK;
}
