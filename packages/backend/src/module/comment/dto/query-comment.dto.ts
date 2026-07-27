import { IsInt, IsOptional, Min, Max, IsDefined } from 'class-validator';
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
  @Max(50, { message: '每页数量最大为 50' })
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @IsInt()
  @Min(1, { message: '文章ID必须大于0' })
  @Type(() => Number)
  @IsDefined({ message: '文章ID不能为空' })
  postId: number;
}
