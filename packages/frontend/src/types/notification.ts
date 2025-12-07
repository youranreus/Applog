/**
 * 通知类型
 */
export type NotificationType = 'success' | 'error' | 'info';

/**
 * 通知配置接口
 */
export interface INotificationOptions {
  /** 通知标题 */
  title: string;
  /** 副标题（可选） */
  subtitle?: string;
  /** 通知内容 */
  content: string;
  /** 是否可关闭（默认 true） */
  closable?: boolean;
  /** 持续时间（毫秒，默认 3000，0 表示不自动关闭） */
  duration?: number;
  /** 通知类型（用于设置 titleRightText） */
  type?: NotificationType;
}

/**
 * 通知接口
 */
export interface INotification extends Omit<INotificationOptions, 'duration' | 'closable' | 'type'> {
  /** 唯一标识 */
  id: string;
  /** 是否可关闭 */
  closable: boolean;
  /** 持续时间（毫秒，0 表示不自动关闭） */
  duration: number;
  /** 通知类型 */
  type: NotificationType;
}
