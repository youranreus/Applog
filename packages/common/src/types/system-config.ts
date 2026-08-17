/**
 * 系统基础配置接口
 */
export interface ISystemBaseConfig {
  /** 系统标题 */
  title: string;
  /** 系统描述 */
  description: string;
  /** 是否允许用户登录 */
  allowUserLogin: boolean;
  /** 是否允许评论 */
  allowComment: boolean;
  /**
   * 建站时间（本地时间 `YYYY-MM-DDTHH:mm`，兼容旧的 `YYYY-MM-DD`）
   * 空字符串或未设置时，前台不展示运行时间
   */
  siteFoundedDate?: string;
  /**
   * 备案号原文
   * 空字符串或未设置时，前台不展示备案信息
   */
  icpFilingNumber?: string;
  /**
   * 个人首页标题
   * 空字符串或未设置时，Landing 使用系统标题
   */
  landingTitle?: string;
  /**
   * 个人首页副标题
   * 空字符串时隐藏；未设置时沿用兼容默认文案
   */
  landingBio?: string;
  /**
   * 个人首页底部 Slogan
   * 空字符串时隐藏；未设置时沿用兼容默认文案
   */
  landingSlogan?: string;
  /**
   * 作者所在城市，用于服务端查询当前天气
   * 空字符串或未设置时，Landing 不展示天气
   */
  weatherCity?: string;
  /**
   * 个人主页链接
   * 字段缺失时前端回退 `/about.html`；显式空字符串表示隐藏
   */
  personalHomepageUrl?: string;
  /** Bilibili 主页链接；空字符串或未设置时隐藏 */
  bilibiliUrl?: string;
  /** GitHub 主页链接；空字符串时隐藏，未设置时沿用兼容默认链接 */
  githubUrl?: string;
  /** Landing 昨日状态目标步数；未设置时回退 Garmin 目标 */
  landingStepGoal?: number;
}

/**
 * Umami 自建实例对接配置（存于 SYSTEM_UMAMI_CONFIG）
 * 密码仅服务端持有；管理端读回为脱敏占位
 */
export interface IUmamiConfig {
  /** Umami 实例根地址（无尾斜杠），如 https://umami.example.com */
  baseUrl: string;
  /** Website UUID */
  websiteId: string;
  /**
   * Tracker 脚本 URL；空则由 baseUrl 推导为 `{baseUrl}/script.js`
   */
  scriptUrl?: string;
  /** Umami 登录用户名 */
  username: string;
  /**
   * Umami 登录密码
   * 存储明文于 DB（仅服务端读）；API 读回为脱敏占位；提交空或占位表示不修改
   */
  password: string;
  /**
   * 总开关；缺省视为 true（仍需必填项齐备才启用 tracker / 查询）
   */
  enabled?: boolean;
}

/**
 * 公开 Tracker 引导信息（不含凭证）
 */
export interface IUmamiTrackerConfig {
  /** 是否应注入 tracker */
  enabled: boolean;
  /** 脚本 URL（enabled 为 true 时有值） */
  scriptUrl: string;
  /** Website UUID（enabled 为 true 时有值） */
  websiteId: string;
}

/**
 * Duolingo 学习统计配置（存于 SYSTEM_DUOLINGO_CONFIG）
 * JWT 仅服务端持有；管理端读回为脱敏占位。
 */
export interface IDuolingoConfig {
  /** Duolingo 用户名 */
  username: string;
  /** Duolingo JWT；空值或脱敏占位提交表示保留旧值 */
  jwt: string;
  /** 决定自然日边界的 IANA 时区 */
  timeZone: string;
  /** Landing 展示总开关 */
  enabled: boolean;
}

/** 评论邮件通知配置（存于 SYSTEM_NOTIFICATION_CONFIG）。 */
export interface INotificationConfig {
  /** H Notification Key；空值或脱敏占位提交表示保留旧值。 */
  mailToken: string;
  /** 评论邮件通知总开关。 */
  enabled: boolean;
}
