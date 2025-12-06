/**
 * 系统配置相关常量
 */

/**
 * 系统配置默认前缀
 * 用于标识系统级配置，需要管理员权限访问
 */
export const SYSTEM_CONFIG_PREFIX_DEFAULT = 'SYSTEM_';

/**
 * 系统基础配置 key 后缀
 */
export const SYSTEM_BASE_CONFIG_KEY = 'BASE_CONFIG';

/**
 * 系统配置 key 映射
 * 用于生成完整的配置 key（需要配合 systemKeyPrefix 使用）
 */
export const SYSTEM_CONFIG_KEYS = {
  /** 系统基础配置 */
  BASE_CONFIG: SYSTEM_BASE_CONFIG_KEY,
} as const;
