/**
 * 配置项响应 DTO
 */
export interface IConfigResponseDto {
  id: number;
  configKey: string;
  configValue: string;
  description?: string;
  extra?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 系统初始化响应 DTO
 */
export interface IInitResponseDto {
  /** 响应消息 */
  message: string;
}
