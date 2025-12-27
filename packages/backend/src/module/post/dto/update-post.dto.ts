import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  IsObject,
  Matches,
} from 'class-validator';

/**
 * 文章状态类型
 */
type PostStatus = 'draft' | 'published' | 'archived';

/**
 * 更新文章 DTO（所有字段都是可选的，支持局部更新）
 */
export class UpdatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'slug 最多 255 个字符' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug 只能包含小写字母、数字和连字符',
  })
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: '文章标题最多 255 个字符' })
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '文章摘要最多 500 个字符' })
  summary?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '封面地址最多 500 个字符' })
  cover?: string;

  @IsEnum(['draft', 'published', 'archived'], {
    message: '文章状态只能是 draft、published 或 archived',
  })
  @IsOptional()
  status?: PostStatus;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;
}

