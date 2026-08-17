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
 * Umami 对接配置 key 后缀
 */
export const SYSTEM_UMAMI_CONFIG_KEY = 'UMAMI_CONFIG';

/**
 * Duolingo 学习统计配置 key 后缀
 */
export const SYSTEM_DUOLINGO_CONFIG_KEY = 'DUOLINGO_CONFIG';

/** 评论邮件通知配置 key 后缀 */
export const SYSTEM_NOTIFICATION_CONFIG_KEY = 'NOTIFICATION_CONFIG';

/**
 * Umami 密码读回脱敏占位（空密码提交表示不修改）
 */
export const UMAMI_PASSWORD_MASK = '********';

/**
 * Duolingo JWT 读回脱敏占位
 */
export const DUOLINGO_JWT_MASK = '********';

/** 评论邮件 token 读回脱敏占位 */
export const NOTIFICATION_MAIL_TOKEN_MASK = '********';

/**
 * 系统配置 key 映射
 * 用于生成完整的配置 key（需要配合 systemKeyPrefix 使用）
 */
export const SYSTEM_CONFIG_KEYS = {
  /** 系统基础配置 */
  BASE_CONFIG: SYSTEM_BASE_CONFIG_KEY,
  /** Umami 流量分析对接配置（含凭证，仅 admin） */
  UMAMI_CONFIG: SYSTEM_UMAMI_CONFIG_KEY,
  /** Duolingo 学习统计配置（含凭证，仅 admin） */
  DUOLINGO_CONFIG: SYSTEM_DUOLINGO_CONFIG_KEY,
  /** 评论邮件通知配置（含凭证，仅 admin） */
  NOTIFICATION_CONFIG: SYSTEM_NOTIFICATION_CONFIG_KEY,
} as const;
