import { computed } from 'vue';
import { usePostListStore } from '@/stores/usePostListStore';
import type { IPostListItem, IPaginationMeta } from '@/types/post';

/**
 * 文章列表业务逻辑 Hooks
 * 封装文章列表相关的业务逻辑，实现视图与逻辑分离
 * 
 * 逻辑说明：
 * 1. 从 Store 获取文章列表数据和分页信息
 * 2. 提供分页处理方法
 * 3. 提供日期格式化方法
 * 4. 返回响应式的数据和方法供视图层使用
 */
export function usePostList() {
  const store = usePostListStore();

  /**
   * 文章列表（只读）
   */
  const posts = computed<IPostListItem[]>(() => {
    return store.posts;
  });

  /**
   * 分页元数据（只读）
   */
  const pagination = computed<IPaginationMeta | undefined>(() => {
    return store.pagination;
  });

  /**
   * 加载状态
   */
  const loading = computed<boolean>(() => {
    return store.loading;
  });

  /**
   * 处理页码变化
   * @param page - 目标页码（从 1 开始）
   */
  function handlePageChange(page: number): void {
    store.setPage(page);
  }

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   * @param date - 日期对象或日期字符串
   * @returns 格式化后的日期字符串
   */
  function formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  return {
    posts,
    pagination,
    loading,
    handlePageChange,
    formatDate,
  };
}

