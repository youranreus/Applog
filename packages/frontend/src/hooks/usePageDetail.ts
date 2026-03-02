import { computed, type Ref } from 'vue';
import { useWatcher } from 'alova/client';
import { getPageBySlug } from '@/api/page/getPageBySlug';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { IPageDetail } from '@/types/page';

/**
 * 页面详情 Hook
 * 用于获取和管理页面详情数据
 * @param slug - 页面 slug（可以是响应式引用或字符串）
 * @returns 页面详情相关的状态和方法
 * 
 * 逻辑说明：
 * 1. 使用 useRequest 调用 getPageBySlug API
 * 2. alova 会自动追踪 slugRef 的变化，当 slug 变化时自动重新请求
 * 3. 返回加载状态、数据和错误信息
 */
export function usePageDetail(slug: Ref<string> | string) {
  /**
   * 将 slug 转换为响应式引用
   * 如果传入的是字符串，则创建一个计算属性
   */
  const slugRef = typeof slug === 'string' 
    ? computed(() => slug) 
    : slug;

  /**
   * 使用 alova 的 useWatcher 获取页面详情
   * 传入函数形式，alova 会自动追踪 slugRef 的变化
   * 当 slugRef.value 变化时，会自动重新请求数据
   */
  const {
    loading,
    data: pageDetail,
    error,
    send: refresh,
  } = useWatcher(
    () => getPageBySlug(slugRef.value),
    [slugRef],
    {
      immediate: true, // 立即请求
    },
  );

  /**
   * 页面详情数据（只读）
   */
  const page = computed<IPageDetail | undefined>(() => {
    return pageDetail.value;
  });

  useDocumentTitle(computed(() => page.value?.title));

  return {
    // 页面详情数据
    page,
    // 加载状态
    loading,
    // 错误信息
    error,
    // 刷新方法，手动触发重新请求
    refresh,
  };
}

