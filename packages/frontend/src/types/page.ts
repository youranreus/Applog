/**
 * 页面详情类型
 * 对应后端的 IPageResponseDto（PageExportData）
 */
export interface IPageDetail {
  /** 页面 ID */
  id: number;
  /** 页面标题 */
  title: string;
  /** 页面内容 */
  content: string;
  /** 页面摘要 */
  summary?: string;
  /** 封面图片 */
  cover?: string;
  /** 页面唯一标识（用于路由） */
  slug: string;
  /** 页面状态 */
  status: 'draft' | 'published' | 'archived';
  /** 浏览次数 */
  viewCount: number;
  /** 是否展示于导航栏 */
  showInNav: boolean;
  /** 是否展示于 Footer */
  showInFooter: boolean;
  /** 作者 ID */
  authorId: number;
  /** 作者信息（可选） */
  author?: {
    id: number;
    name: string;
    avatar?: string;
  };
  /** 标签列表 */
  tags?: string[];
  /** 扩展信息 */
  extra?: Record<string, any>;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

