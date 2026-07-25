import type { IUmamiConfig, IUmamiTrackerConfig } from '../types/system-config.js';
import { UMAMI_PASSWORD_MASK } from '../constants/system-config.js';

/**
 * 去掉 baseUrl 尾部斜杠
 * @param baseUrl - 原始地址
 * @returns 规范化后的根地址
 */
export function normalizeUmamiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * 由 baseUrl 推导默认 scriptUrl
 * @param baseUrl - Umami 根地址
 * @returns `{baseUrl}/script.js`
 */
export function deriveUmamiScriptUrl(baseUrl: string): string {
  const normalized = normalizeUmamiBaseUrl(baseUrl);
  return normalized ? `${normalized}/script.js` : '';
}

/**
 * 解析有效的 scriptUrl（显式优先，否则由 baseUrl 推导）
 * @param config - Umami 配置片段
 * @returns scriptUrl 或空串
 */
export function resolveUmamiScriptUrl(
  config: Pick<IUmamiConfig, 'baseUrl' | 'scriptUrl'>,
): string {
  const explicit = (config.scriptUrl || '').trim();
  if (explicit) {
    return explicit;
  }
  return deriveUmamiScriptUrl(config.baseUrl || '');
}

/**
 * 判断查询代理所需凭证是否齐备
 * @param config - 完整配置
 * @returns 是否可用于服务端查询
 */
export function isUmamiQueryConfigured(config: IUmamiConfig | null | undefined): boolean {
  if (!config) {
    return false;
  }
  if (config.enabled === false) {
    return false;
  }
  const baseUrl = normalizeUmamiBaseUrl(config.baseUrl || '');
  const websiteId = (config.websiteId || '').trim();
  const username = (config.username || '').trim();
  const password = (config.password || '').trim();
  return !!baseUrl && !!websiteId && !!username && !!password;
}

/**
 * 由完整配置生成公开 Tracker 引导信息
 * @param config - 库中配置（可为 null）
 * @returns 公开引导 DTO
 */
export function toUmamiTrackerConfig(
  config: IUmamiConfig | null | undefined,
): IUmamiTrackerConfig {
  if (!config || config.enabled === false) {
    return { enabled: false, scriptUrl: '', websiteId: '' };
  }

  const websiteId = (config.websiteId || '').trim();
  const scriptUrl = resolveUmamiScriptUrl(config);

  if (!websiteId || !scriptUrl) {
    return { enabled: false, scriptUrl: '', websiteId: '' };
  }

  return { enabled: true, scriptUrl, websiteId };
}

/**
 * 管理端读回时脱敏密码
 * @param config - 完整配置
 * @returns 密码替换为占位符的副本
 */
export function maskUmamiConfigPassword(config: IUmamiConfig): IUmamiConfig {
  const hasPassword = !!(config.password || '').trim();
  return {
    ...config,
    baseUrl: normalizeUmamiBaseUrl(config.baseUrl || ''),
    password: hasPassword ? UMAMI_PASSWORD_MASK : '',
  };
}

/**
 * 判断提交的密码是否表示「不修改」
 * @param password - 表单提交的密码
 * @returns 是否应保留原密码
 */
export function shouldKeepExistingUmamiPassword(password: string | undefined): boolean {
  const trimmed = (password || '').trim();
  return trimmed === '' || trimmed === UMAMI_PASSWORD_MASK;
}
