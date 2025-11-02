import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建评论 DTO
 */
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: '评论内容不能为空' })
  content: string;

  @IsInt()
  @Min(1, { message: '文章ID必须大于0' })
  @Type(() => Number)
  postId: number;

  @IsInt()
  @Min(1, { message: '父评论ID必须大于0' })
  @Type(() => Number)
  @IsOptional()
  parentId?: number;
}

