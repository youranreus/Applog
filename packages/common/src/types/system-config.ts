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
