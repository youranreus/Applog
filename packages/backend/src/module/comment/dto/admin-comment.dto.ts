import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CommentExportData } from '@/entities';

export class AdminQueryCommentDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) postId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageId?: number;
}

export interface IAdminCommentDto
  extends Omit<CommentExportData, 'withdrawTokenHash'> {
  post?: { id: number; title: string; slug: string };
  page?: { id: number; title: string; slug: string };
  descendantCount: number;
}

export interface IDeleteImpactDto {
  id: number;
  descendantCount: number;
  totalCount: number;
}
