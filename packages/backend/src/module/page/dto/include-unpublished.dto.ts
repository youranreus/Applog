import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 是否包含未发布内容的查询参数
 * 仅在请求者为 admin 且显式传 true 时生效
 */
export class IncludeUnpublishedQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeUnpublished?: boolean = false;
}
