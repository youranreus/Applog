import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  IsObject,
  IsBoolean,
} from 'class-validator';

/**
 * 页面状态类型
 */
type PageStatus = 'draft' | 'published' | 'archived';

/**
 * 更新页面 DTO（所有字段都是可选的，支持局部更新）
 */
export class UpdatePageDto {
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: '页面标题最多 255 个字符' })
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '页面摘要最多 500 个字符' })
  summary?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '封面地址最多 500 个字符' })
  cover?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: '页面slug最多 255 个字符' })
  slug?: string;

  @IsEnum(['draft', 'published', 'archived'], {
    message: '页面状态只能是 draft、published 或 archived',
  })
  @IsOptional()
  status?: PageStatus;

  @IsBoolean()
  @IsOptional()
  showInNav?: boolean;

  @IsBoolean()
  @IsOptional()
  showInFooter?: boolean;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;
}
