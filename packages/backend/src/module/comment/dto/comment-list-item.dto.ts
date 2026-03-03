/**
 * 评论列表项 DTO
 */
export interface ICommentListItemDto {
  id: number;
  content: string;
  postId: number;
  authorId: number;
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  parentId?: number;
  status: 'pending' | 'approved' | 'rejected';
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}
