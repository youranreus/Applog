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
}
