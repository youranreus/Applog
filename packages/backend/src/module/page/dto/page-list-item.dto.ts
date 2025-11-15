/**
 * 页面列表项 DTO
 * 不包含完整的 content，只返回必要信息
 */
export interface IPageListItemDto {
  id: number;
  title: string;
  summary?: string;
  cover?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  showInNav: boolean;
  showInFooter: boolean;
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

/**
 * 导航/Footer页面项 DTO
 * 用于导航栏和footer展示，只包含必要信息
 */
export interface IPageNavItemDto {
  id: number;
  title: string;
  slug: string;
  showInNav: boolean;
  showInFooter: boolean;
}
