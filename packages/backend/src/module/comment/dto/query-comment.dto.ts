import { IsInt, IsOptional, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 评论状态类型
 */
export type CommentStatus = 'pending' | 'approved' | 'rejected';

/**
 * 查询评论列表 DTO
 */
export class QueryCommentDto {
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

  @IsInt()
  @Min(1, { message: '文章ID必须大于0' })
  @Type(() => Number)
  @IsOptional()
  postId?: number;

  @IsEnum(['pending', 'approved', 'rejected'], {
    message: '评论状态只能是 pending、approved 或 rejected',
  })
  @IsOptional()
  status?: CommentStatus;
}
