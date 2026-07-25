import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 趋势查询参数
 */
export class QueryTrendDto {
  @IsOptional()
  @IsInt({ message: 'days 必须是整数' })
  @Min(1, { message: 'days 至少为 1' })
  @Max(90, { message: 'days 最多为 90' })
  days?: number;
}

/**
 * Top 榜查询参数（单栏 path Top）
 */
export class QueryTopDto {
  @IsOptional()
  @IsInt({ message: 'days 必须是整数' })
  @Min(1, { message: 'days 至少为 1' })
  @Max(90, { message: 'days 最多为 90' })
  days?: number;

  @IsOptional()
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 至少为 1' })
  @Max(50, { message: 'limit 最多为 50' })
  limit?: number;
}

/**
 * Breakdown 维度
 */
export type AnalyticsBreakdownDimension = 'os' | 'device' | 'country';

/**
 * Breakdown 查询参数
 */
export class QueryBreakdownDto {
  @IsIn(['os', 'device', 'country'], {
    message: 'dimension 只能是 os、device 或 country',
  })
  dimension: AnalyticsBreakdownDimension;

  @IsOptional()
  @IsInt({ message: 'days 必须是整数' })
  @Min(1, { message: 'days 至少为 1' })
  @Max(90, { message: 'days 最多为 90' })
  days?: number;

  @IsOptional()
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 至少为 1' })
  @Max(50, { message: 'limit 最多为 50' })
  limit?: number;
}

/**
 * 管理端写入 Umami 配置 DTO
 */
export class SetUmamiConfigDto {
  @IsString({ message: 'baseUrl 必须是字符串' })
  @MaxLength(512, { message: 'baseUrl 过长' })
  baseUrl: string;

  @IsString({ message: 'websiteId 必须是字符串' })
  @MaxLength(128, { message: 'websiteId 过长' })
  websiteId: string;

  @IsOptional()
  @IsString({ message: 'scriptUrl 必须是字符串' })
  @MaxLength(512, { message: 'scriptUrl 过长' })
  scriptUrl?: string;

  @IsString({ message: 'username 必须是字符串' })
  @MaxLength(128, { message: 'username 过长' })
  username: string;

  @IsOptional()
  @IsString({ message: 'password 必须是字符串' })
  @MaxLength(256, { message: 'password 过长' })
  password?: string;

  @IsOptional()
  @IsBoolean({ message: 'enabled 必须是布尔值' })
  enabled?: boolean;
}
