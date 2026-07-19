import { computed, ref } from 'vue';
import { useWatcher } from 'alova/client';
import { getPageList } from '@/api/page/getPageList';
import type { IPageListItem, IQueryPage, IPagination, IPaginationMeta } from '@/types/page';

/**
 * 页面列表 Hook
 * 管理页面列表数据，支持分页、搜索和标签筛选
 * @returns 页面列表相关的状态和方法
 *
 * 逻辑说明：
 * 1. 使用 useWatcher 调用 getPageList API 获取页面列表
 * 2. 监听 queryParams，变化时自动重新请求
 * 3. 初始数据为空列表与默认分页信息
 * 4. 通过 setPage / setKeyword 等方法修改查询参数
 */
export function usePageList() {
  /**
   * 查询参数（响应式）
   * 变化时由 useWatcher 触发重新请求
   */
  const queryParams = ref<IQueryPage>({
    page: 1,
    limit: 10,
    includeUnpublished: true,
  });

  /**
   * 使用 alova 的 useWatcher 获取页面列表
   * 接口路径: GET /page
   * 响应拦截器会自动提取 data 字段，返回 IPagination<IPageListItem> 类型
   */
  const {
    loading,
    data: pageListData,
    error,
    send: refresh,
  } = useWatcher(
    () => getPageList(queryParams.value),
    [queryParams],
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
      } as IPagination<IPageListItem>,
    },
  );

  /**
   * 页面列表（只读）
   * 从分页响应中提取 items 数组
   */
  const pages = computed<IPageListItem[]>(() => {
    if (!pageListData.value) {
      return [];
    }
    return pageListData.value.items || [];
  });

  /**
   * 分页元数据（只读）
   * 包含总条数、总页数、当前页等信息
   */
  const pagination = computed<IPaginationMeta | undefined>(() => {
    return pageListData.value?.meta;
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
  }

  /**
   * 重置查询参数
   * 恢复到初始状态（第一页，默认每页数量，无搜索和筛选）
   */
  function resetQuery(): void {
    queryParams.value = {
      page: 1,
      limit: 10,
      includeUnpublished: true,
    };
  }

  return {
    // 只读的页面列表
    pages,
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
}
