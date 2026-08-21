import { WAKATIME_API_KEY_MASK } from "../constants/system-config.js";
import type { IWakaTimeConfig } from "../types/system-config.js";
import { isValidIanaTimeZone } from "./duolingo-config.js";

export const DEFAULT_WAKATIME_TIME_ZONE = "Asia/Shanghai";

/** 当配置启用且凭证/时区均可用时才允许抓取。 */
export function isWakaTimeConfigured(
  config: IWakaTimeConfig | null | undefined,
): boolean {
  return Boolean(
    config?.enabled &&
      config.apiKey?.trim() &&
      isValidIanaTimeZone(config.timeZone),
  );
}

/** 管理端读回时仅表达“是否已保存”，不返回 API key。 */
export function maskWakaTimeConfigApiKey(
  config: IWakaTimeConfig,
): IWakaTimeConfig {
  return {
    apiKey: config.apiKey?.trim() ? WAKATIME_API_KEY_MASK : "",
    timeZone: config.timeZone?.trim() || DEFAULT_WAKATIME_TIME_ZONE,
    enabled: config.enabled === true,
  };
}

/** 空值或脱敏占位表示保留已存凭证。 */
export function shouldKeepExistingWakaTimeApiKey(
  apiKey: string | undefined,
): boolean {
  const value = (apiKey || "").trim();
  return value === "" || value === WAKATIME_API_KEY_MASK;
}
