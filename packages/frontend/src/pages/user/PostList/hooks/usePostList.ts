import { computed } from 'vue';
import { useAdminStore } from '@/stores/useAdminStore';
import type { IPostListItem, IPaginationMeta } from '@/types/post';

/**
 * 后台文章列表业务逻辑 Hook
 * 从 useAdminStore 的 postListService 获取数据与方法，实现视图与逻辑分离
 *
 * 逻辑说明：
 * 1. 从 Store 获取文章列表数据和分页、筛选状态
 * 2. 分页与筛选数据持久化在 store 中，切换路由再回来可保留状态
 * 3. 提供分页、搜索、筛选等处理方法供视图层使用
 */
export function usePostList() {
  const store = useAdminStore();
  const service = store.postListService;

  /**
   * 文章列表（只读）
   */
  const posts = computed<IPostListItem[]>(() => service.posts);

  /**
   * 分页元数据（只读）
   */
  const pagination = computed<IPaginationMeta | undefined>(() => service.pagination);

  /**
   * 加载状态
   */
  const loading = computed<boolean>(() => service.loading);

  /**
   * 搜索关键字（只读）
   */
  const keyword = computed<string | undefined>(() => service.queryParams.keyword);

  /**
   * 设置页码
   * @param page - 页码（从 1 开始）
   */
  function setPage(page: number): void {
    service.setPage(page);
  }

  /**
   * 设置每页数量
   * @param limit - 每页数量
   */
  function setLimit(limit: number): void {
    service.setLimit(limit);
  }

  /**
   * 设置搜索关键字
   * @param keyword - 搜索关键字（为空字符串时清除搜索）
   */
  function setKeyword(keyword: string): void {
    service.setKeyword(keyword);
  }

  /**
   * 设置标签筛选
   * @param tags - 标签数组（为空数组时清除筛选）
   */
  function setTags(tags: string[]): void {
    service.setTags(tags);
  }

  /**
   * 重置查询参数
   */
  function resetQuery(): void {
    service.resetQuery();
  }

  return {
    posts,
    pagination,
    keyword,
    queryParams: service.queryParams,
    loading,
    error: service.error,
    refresh: service.refresh,
    setPage,
    setLimit,
    setKeyword,
    setTags,
    resetQuery,
  };
}
