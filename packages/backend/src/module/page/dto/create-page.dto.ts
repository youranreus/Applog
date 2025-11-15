import {
  IsString,
  IsNotEmpty,
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
 * 创建页面 DTO
 */
export class CreatePageDto {
  @IsString()
  @IsNotEmpty({ message: '页面标题不能为空' })
  @MaxLength(255, { message: '页面标题最多 255 个字符' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '页面内容不能为空' })
  content: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '页面摘要最多 500 个字符' })
  summary?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '封面地址最多 500 个字符' })
  cover?: string;

  @IsString()
  @IsNotEmpty({ message: '页面slug不能为空' })
  @MaxLength(255, { message: '页面slug最多 255 个字符' })
  slug: string;

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
