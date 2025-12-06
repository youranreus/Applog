import { SYSTEM_CONFIG_PREFIX_DEFAULT, SYSTEM_CONFIG_KEYS } from '../constants/system-config.js';

/**
 * 生成完整的系统配置 key
 * @param key - 系统配置 key 后缀（如 SYSTEM_CONFIG_KEYS.BASE_CONFIG）
 * @param prefix - 可选的前缀，默认为 SYSTEM_CONFIG_PREFIX_DEFAULT
 * @returns 完整的系统配置 key（前缀 + key）
 * 
 * 逻辑说明：
 * 1. 如果 key 已经是完整 key（已包含前缀），直接返回
 * 2. 否则将前缀和 key 拼接返回
 * 
 * 示例：
 * - getSystemConfigKey(SYSTEM_CONFIG_KEYS.BASE_CONFIG) => 'SYSTEM_BASE_CONFIG'
 * - getSystemConfigKey('SYSTEM_BASE_CONFIG') => 'SYSTEM_BASE_CONFIG'
 */
export function getSystemConfigKey(
  key: string,
  prefix: string = SYSTEM_CONFIG_PREFIX_DEFAULT,
): string {
  // 如果 key 已经包含前缀，直接返回
  if (key.startsWith(prefix)) {
    return key;
  }
  
  // 拼接前缀和 key
  return `${prefix}${key}`;
}

/**
 * 判断给定的 key 是否为系统配置 key
 * @param key - 配置 key
 * @param prefix - 可选的前缀，默认为 SYSTEM_CONFIG_PREFIX_DEFAULT
 * @returns 是否为系统配置 key
 * 
 * 逻辑说明：
 * 1. 检查 key 是否以指定前缀开头
 * 
 * 示例：
 * - isSystemConfigKey('SYSTEM_BASE_CONFIG') => true
 * - isSystemConfigKey('BASE_CONFIG') => false
 */
export function isSystemConfigKey(
  key: string,
  prefix: string = SYSTEM_CONFIG_PREFIX_DEFAULT,
): boolean {
  return key.startsWith(prefix);
}

/**
 * 判断给定的 key 是否为系统配置 key（使用 SYSTEM_CONFIG_KEYS 中的值）
 * @param key - 配置 key 后缀（如 SYSTEM_CONFIG_KEYS.BASE_CONFIG）
 * @returns 是否为系统配置 key
 * 
 * 逻辑说明：
 * 1. 检查 key 是否在 SYSTEM_CONFIG_KEYS 的值中
 * 
 * 示例：
 * - isSystemConfigKeySuffix(SYSTEM_CONFIG_KEYS.BASE_CONFIG) => true
 * - isSystemConfigKeySuffix('OTHER_KEY') => false
 */
export function isSystemConfigKeySuffix(key: string): boolean {
  const systemConfigValues = Object.values(SYSTEM_CONFIG_KEYS) as readonly string[];
  return systemConfigValues.includes(key);
}

