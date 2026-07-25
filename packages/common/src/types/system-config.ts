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
   * 建站日期（ISO 日期 `YYYY-MM-DD`）
   * 空字符串或未设置时，前台不展示运行时间
   */
  siteFoundedDate?: string;
  /**
   * 备案号原文
   * 空字符串或未设置时，前台不展示备案信息
   */
  icpFilingNumber?: string;
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
