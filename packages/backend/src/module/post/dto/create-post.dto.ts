import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  IsObject,
} from 'class-validator';

/**
 * 文章状态类型
 */
type PostStatus = 'draft' | 'published' | 'archived';

/**
 * 创建文章 DTO
 */
export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: '文章标题不能为空' })
  @MaxLength(255, { message: '文章标题最多 255 个字符' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '文章内容不能为空' })
  content: string;

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

