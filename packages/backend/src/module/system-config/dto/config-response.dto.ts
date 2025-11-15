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
 * 配置项批量响应
 */
export type ConfigBatchRecord = Record<string, IConfigResponseDto | null>;
