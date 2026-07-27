import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CommentLocationQueryDto {
  @IsInt()
  @Min(1, { message: '每页数量最小为 1' })
  @Max(50, { message: '每页数量最大为 50' })
  @Type(() => Number)
  @IsOptional()
  limit = 10;
}

export interface ICommentLocationDto {
  page: number;
  rootCommentId: number;
}
