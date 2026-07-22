import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { AnalyticsContentType } from '@/entities';

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
 * Top 榜查询参数
 */
export class QueryTopDto {
  @IsEnum(['post', 'page'], {
    message: 'type 只能是 post 或 page',
  })
  type: AnalyticsContentType;

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
