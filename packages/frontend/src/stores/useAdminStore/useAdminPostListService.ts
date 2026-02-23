import { computed, ref } from 'vue';
import { useRequest } from 'alova/client';
import { getPostList } from '@/api/post/getPostList';
import type { IPostListItem, IQueryPost, IPagination, IPaginationMeta } from '@/types/post';

/**
 * 后台文章列表数据管理子模块
 * 管理文章列表数据，支持分页、搜索和标签筛选，供 useAdminStore 组合使用
 *
 * 逻辑说明：
 * 1. 使用 useRequest 调用 getPostList API 获取文章列表
 * 2. 查询参数变化后通过 refresh 触发重新请求
 * 3. 提供 setPage、setKeyword 等方法修改查询参数并刷新
 */
export function useAdminPostListService() {
  /**
   * 查询参数（响应式）
   * 当参数变化时，通过 refresh 触发重新请求
   */
  const queryParams = ref<IQueryPost>({
    page: 1,
    limit: 10,
  });

  /**
   * 使用 alova 的 useRequest 获取文章列表
   * 接口路径: GET /post
   * 响应拦截器会自动提取 data 字段，返回 IPagination<IPostListItem> 类型
   *
   * 逻辑说明：
   * 1. 使用函数形式传入请求方法，传入 queryParams.value
   * 2. 修改 queryParams 后调用 refresh() 触发重新请求
   * 3. 初始数据设置为空列表和默认分页信息
   */
  const {
    loading,
    data: postListData,
    error,
    send: refresh,
  } = useRequest(
    () => getPostList(queryParams.value),
    {
      immediate: true,
      initialData: {
        items: [],
        meta: {
          itemCount: 0,
          totalItems: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      } as IPagination<IPostListItem>,
    },
  );

  /**
   * 文章列表（只读）
   * 从分页响应中提取 items 数组
   */
  const posts = computed<IPostListItem[]>(() => {
    if (!postListData.value) {
      return [];
    }
    return postListData.value.items || [];
  });

  /**
   * 分页元数据（只读）
   * 包含总条数、总页数、当前页等信息
   */
  const pagination = computed<IPaginationMeta | undefined>(() => {
    return postListData.value?.meta;
  });

  /**
   * 设置页码
   * @param page - 页码（从 1 开始）
   */
  function setPage(page: number): void {
    if (page < 1) {
      return;
    }
    queryParams.value = {
      ...queryParams.value,
      page,
    };
    refresh();
  }

  /**
   * 设置每页数量
   * @param limit - 每页数量
   */
  function setLimit(limit: number): void {
    if (limit < 1) {
      return;
    }
    queryParams.value = {
      ...queryParams.value,
      limit,
      page: 1,
    };
    refresh();
  }

  /**
   * 设置搜索关键字
   * @param keyword - 搜索关键字（为空字符串时清除搜索）
   */
  function setKeyword(keyword: string): void {
    queryParams.value = {
      ...queryParams.value,
      keyword: keyword || undefined,
      page: 1,
    };
    refresh();
  }

  /**
   * 设置标签筛选
   * @param tags - 标签数组（为空数组时清除筛选）
   */
  function setTags(tags: string[]): void {
    queryParams.value = {
      ...queryParams.value,
      tags: tags.length > 0 ? tags : undefined,
      page: 1,
    };
    refresh();
  }

  /**
   * 重置查询参数
   * 恢复到初始状态（第一页，默认每页数量，无搜索和筛选）
   */
  function resetQuery(): void {
    queryParams.value = {
      page: 1,
      limit: 10,
    };
    refresh();
  }

  return {
    posts,
    pagination,
    queryParams,
    loading,
    error,
    refresh,
    setPage,
    setLimit,
    setKeyword,
    setTags,
    resetQuery,
  };
}
