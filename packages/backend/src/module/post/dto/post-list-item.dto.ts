/**
 * 文章列表项 DTO
 * 不包含完整的 content，只返回必要信息
 */
export interface IPostListItemDto {
  id: number;
  title: string;
  summary?: string;
  cover?: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  authorId: number;
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}
