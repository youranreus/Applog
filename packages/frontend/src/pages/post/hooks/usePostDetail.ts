import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useWatcher } from 'alova/client';
import { getPostBySlug } from '@/api/post/getPostById';
import { useSeoHead } from '@/hooks/useSeoHead';
import { useArticleJsonLd } from '@/hooks/useJsonLd';
import type { IPostDetail } from '@/types/post';

/**
 * 文章详情业务逻辑 Hooks
 * 封装文章详情相关的业务逻辑，实现视图与逻辑分离
 * 
 * 逻辑说明：
 * 1. 从路由参数中获取文章 slug
 * 2. 使用 useRequest 调用 API 获取文章详情
 * 3. 提供日期格式化方法
 * 4. 返回响应式的数据和方法供视图层使用
 */
export function usePostDetail() {
  const route = useRoute();
  
  /**
   * 文章 slug（从路由参数获取）
   */
  const postSlug = computed<string>(() => {
    const slug = route.params.slug;
    return typeof slug === 'string' ? slug : String(slug || '');
  });

  /**
   * 使用 alova 的 useRequest 获取文章详情
   * 接口路径: GET /post/:slug
   * 响应拦截器会自动提取 data 字段，返回 IPostDetail 类型
   * 
   * 逻辑说明：
   * 1. 使用函数形式传入请求方法，alova 会自动追踪 postSlug 的变化
   * 2. 当 postSlug.value 变化时，会自动重新请求数据
   * 3. 初始数据设置为 null
   */
  const {
    loading,
    data: postDetail,
    error,
    send: refresh,
  } = useWatcher(
    () => getPostBySlug(postSlug.value),
    [postSlug],
    {
      immediate: true, // 立即请求
    },
  );

  /**
   * 文章详情数据（只读）
   */
  const post = computed<IPostDetail | null>(() => {
    return postDetail.value;
  });

  const SITE_URL = import.meta.env.VITE_SITE_URL || '';

  useSeoHead({
    title: computed(() => post.value?.title),
    description: computed(() => post.value?.summary),
    image: computed(() => post.value?.cover),
    canonicalPath: computed(() => post.value?.slug ? `/archives/${post.value.slug}.html` : undefined),
    type: 'article',
    publishedTime: computed(() => post.value?.createdAt),
    modifiedTime: computed(() => post.value?.updatedAt),
    tags: computed(() => post.value?.tags),
    authorName: computed(() => post.value?.author?.name),
  });

  useArticleJsonLd({
    title: post.value?.title || '',
    description: post.value?.summary,
    url: post.value?.slug ? `${SITE_URL}/archives/${post.value.slug}.html` : undefined,
    image: post.value?.cover,
    datePublished: post.value?.createdAt ? new Date(post.value.createdAt).toISOString() : undefined,
    dateModified: post.value?.updatedAt ? new Date(post.value.updatedAt).toISOString() : undefined,
    authorName: post.value?.author?.name,
    tags: post.value?.tags,
  });

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
    post,
    loading,
    error,
    refresh,
    formatDate,
  };
}

