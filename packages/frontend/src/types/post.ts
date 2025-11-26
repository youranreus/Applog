/**
 * 文章列表项类型
 * 对应后端的 IPostListItemDto
 */
export interface IPostListItem {
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

