import { DUOLINGO_JWT_MASK } from '../constants/system-config.js';
import type { IDuolingoConfig } from '../types/system-config.js';

export const DEFAULT_DUOLINGO_TIME_ZONE = 'Asia/Shanghai';

/**
 * 验证 IANA 时区名称。
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
 */
export function shouldKeepExistingDuolingoJwt(
  jwt: string | undefined,
): boolean {
  const value = (jwt || '').trim();
  return value === '' || value === DUOLINGO_JWT_MASK;
}
