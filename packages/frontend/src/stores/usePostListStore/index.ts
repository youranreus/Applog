import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useRequest } from 'alova/client';
import { getPostList } from '@/api/post/getPostList';
import type { IPostListItem, IQueryPost, IPagination, IPaginationMeta } from '@/types/post';

/**
 * 文章列表 Store
 * 管理文章列表数据，支持分页、搜索和标签筛选
 */
export const usePostListStore = defineStore('postList', () => {
  /**
   * 查询参数（响应式）
   * 当参数变化时，useRequest 会自动重新请求数据
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
   * 1. 使用函数形式传入请求方法，alova 会自动追踪 queryParams 的变化
   * 2. 当 queryParams.value 变化时，会自动重新请求数据
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
      immediate: true, // 立即请求
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
      page: 1, // 切换每页数量时重置到第一页
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
      page: 1, // 搜索时重置到第一页
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
      page: 1, // 筛选时重置到第一页
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
    // 只读的文章列表
    posts,
    // 分页元数据
    pagination,
    // 查询参数（可读写，但建议使用提供的方法修改）
    queryParams,
    // 加载状态
    loading,
    // 错误信息
    error,
    // 刷新方法，手动触发重新请求
    refresh,
    // 修改查询参数的方法
    setPage,
    setLimit,
    setKeyword,
    setTags,
    resetQuery,
  };
});

