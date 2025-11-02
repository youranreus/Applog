import type { CommentExportData } from '@/entities';

/**
 * 评论响应 DTO（包含嵌套回复）
 */
export interface ICommentResponseDto extends CommentExportData {
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  replies?: ICommentResponseDto[];
}

