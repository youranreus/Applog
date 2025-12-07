import type { IPagination, IPaginationMeta } from './post';

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
  extra?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 页面列表项类型
 * 对应后端的 IPageListItemDto
 */
export interface IPageListItem {
  /** 页面 ID */
  id: number;
  /** 页面标题 */
  title: string;
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
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 查询页面列表参数
 * 对应后端的 QueryPageDto
 */
export interface IQueryPage {
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 搜索关键字（匹配标题和摘要） */
  keyword?: string;
  /** 标签筛选 */
  tags?: string[];
}

/**
 * 页面状态类型
 */
export type PageStatus = 'draft' | 'published' | 'archived';

/**
 * 创建页面 DTO
 * 对应后端的 CreatePageDto
 */
export interface ICreatePageDto {
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
  status?: PageStatus;
  /** 是否展示于导航栏 */
  showInNav?: boolean;
  /** 是否展示于 Footer */
  showInFooter?: boolean;
  /** 标签列表 */
  tags?: string[];
  /** 扩展信息 */
  extra?: Record<string, unknown>;
}

/**
 * 更新页面 DTO（所有字段都是可选的，支持局部更新）
 * 对应后端的 UpdatePageDto
 */
export interface IUpdatePageDto {
  /** 页面标题 */
  title?: string;
  /** 页面内容 */
  content?: string;
  /** 页面摘要 */
  summary?: string;
  /** 封面图片 */
  cover?: string;
  /** 页面唯一标识（用于路由） */
  slug?: string;
  /** 页面状态 */
  status?: PageStatus;
  /** 是否展示于导航栏 */
  showInNav?: boolean;
  /** 是否展示于 Footer */
  showInFooter?: boolean;
  /** 标签列表 */
  tags?: string[];
  /** 扩展信息 */
  extra?: Record<string, unknown>;
}

/**
 * 导出分页相关类型（从 post.ts 重新导出，便于使用）
 */
export type { IPagination, IPaginationMeta };

