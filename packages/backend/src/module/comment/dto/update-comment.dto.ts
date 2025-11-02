import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 更新评论 DTO
 */
export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty({ message: '评论内容不能为空' })
  content: string;
}

