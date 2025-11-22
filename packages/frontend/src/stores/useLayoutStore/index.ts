import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useRequest } from 'alova/client';
import { getNavPages } from '@/api/page/getNavPages';
import type { IPageNavItem } from '@/types/layout';

/**
 * 布局 Store
 * 管理导航和 Footer 页面列表数据
 */
export const useLayoutStore = defineStore('layout', () => {
  /**
   * 使用 alova 的 useRequest 获取导航和 Footer 页面列表
   * 接口路径: GET /page/nav
   * 响应拦截器会自动提取 data 字段，返回 IPageNavItem[] 类型
   */
  const {
    loading,
    data: allPages,
    error,
    send: refresh,
  } = useRequest(getNavPages, {
    immediate: true, // 立即请求
    initialData: [],
  });

  /**
   * 导航页面列表（只读）
   * 过滤 showInNav === true 的页面
   */
  const navPages = computed<IPageNavItem[]>(() => {
    if (!allPages.value) {
      return [];
    }
    return allPages.value.filter((page: IPageNavItem) => page.showInNav);
  });

  /**
   * Footer 页面列表（只读）
   * 过滤 showInFooter === true 的页面
   */
  const footerPages = computed<IPageNavItem[]>(() => {
    if (!allPages.value) {
      return [];
    }
    return allPages.value.filter((page: IPageNavItem) => page.showInFooter);
  });

  /**
   * 完整的页面列表（只读）
   */
  const pages = computed<IPageNavItem[]>(() => {
    return allPages.value || [];
  });

  return {
    // 只读的页面列表
    navPages,
    footerPages,
    allPages: pages,
    // 加载状态
    loading,
    // 错误信息
    error,
    // 刷新方法，手动触发重新请求
    refresh,
  };
});

