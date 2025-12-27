/**
 * 文章列表项类型
 * 对应后端的 IPostListItemDto
 */
export interface IPostListItem {
  id: number;
  slug: string;
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

/**
 * 查询文章列表参数
 * 对应后端的 QueryPostDto
 */
export interface IQueryPost {
  page?: number;
  limit?: number;
  keyword?: string;
  tags?: string[];
}

/**
 * 分页元数据
 * 对应 nestjs-typeorm-paginate 的 PaginationMeta
 */
export interface IPaginationMeta {
  itemCount: number;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

/**
 * 分页响应结构
 * 对应 nestjs-typeorm-paginate 的 Pagination
 * @template T - 列表项类型
 */
export interface IPagination<T> {
  items: T[];
  meta: IPaginationMeta;
  links?: {
    first?: string;
    previous?: string;
    next?: string;
    last?: string;
  };
}

/**
 * 文章状态类型
 */
export type PostStatus = 'draft' | 'published' | 'archived';

/**
 * 文章详情类型
 * 对应后端的 IPostResponseDto（PostExportData）
 */
export interface IPostDetail {
  /** 文章 ID */
  id: number;
  /** 文章 slug */
  slug: string;
  /** 文章标题 */
  title: string;
  /** 文章内容 */
  content: string;
  /** 文章摘要 */
  summary?: string;
  /** 封面图片 */
  cover?: string;
  /** 文章状态 */
  status: PostStatus;
  /** 浏览次数 */
  viewCount: number;
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
 * 创建文章 DTO
 * 对应后端的 CreatePostDto
 */
export interface ICreatePostDto {
  /** 文章 slug */
  slug: string;
  /** 文章标题 */
  title: string;
  /** 文章内容 */
  content: string;
  /** 文章摘要 */
  summary?: string;
  /** 封面图片 */
  cover?: string;
  /** 文章状态 */
  status?: PostStatus;
  /** 标签列表 */
  tags?: string[];
  /** 扩展信息 */
  extra?: Record<string, unknown>;
}

/**
 * 更新文章 DTO（所有字段都是可选的，支持局部更新）
 * 对应后端的 UpdatePostDto
 */
export interface IUpdatePostDto {
  /** 文章 slug */
  slug?: string;
  /** 文章标题 */
  title?: string;
  /** 文章内容 */
  content?: string;
  /** 文章摘要 */
  summary?: string;
  /** 封面图片 */
  cover?: string;
  /** 文章状态 */
  status?: PostStatus;
  /** 标签列表 */
  tags?: string[];
  /** 扩展信息 */
  extra?: Record<string, unknown>;
}

