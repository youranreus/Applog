import { IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 查询页面列表 DTO
 */
export class QueryPageDto {
  @IsInt()
  @Min(1, { message: '页码最小为 1' })
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1, { message: '每页数量最小为 1' })
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @IsOptional()
  tags?: string[];
}
