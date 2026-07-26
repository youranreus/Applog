import { computed } from 'vue';
import { useRequest } from 'alova/client';
import { getPostList } from '@/api/post/getPostList';
import type { IPostListItem } from '@/types/post';
import type { ILandingPost } from '../types';

/**
 * 将文章列表数据转换为 Landing 所需的稳定视图模型。
 * @param post - 公开文章列表项
 * @returns Landing 最近文章数据
 */
function toLandingPost(post: IPostListItem): ILandingPost {
  const publishedAt = formatLandingDate(post.createdAt);

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary?.trim() || undefined,
    cover: post.cover?.trim() || undefined,
    ...publishedAt,
  };
}

/**
 * 格式化 Landing 文章日期。
 * @param date - 日期对象或可解析的日期字符串
 * @returns 展示日期与机器可读日期；无效日期返回空展示值
 */
function formatLandingDate(
  date: Date | string,
): Pick<ILandingPost, 'publishedAt' | 'publishedAtIso'> {
  const dateValue = typeof date === 'string' ? new Date(date) : date;

  if (Number.isNaN(dateValue.getTime())) {
    return { publishedAt: '' };
  }

  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');

  return {
    publishedAt: `${year}.${month}.${day}`,
    publishedAtIso: dateValue.toISOString(),
  };
}

/**
 * Landing 页面业务逻辑。
 * 独立读取最近 3 篇公开文章，避免修改文章列表页的共享分页状态。
 * @returns 最近文章、加载状态与失败状态
 */
export function useLanding() {
  const {
    loading: postsLoading,
    data: postListData,
    error: postsError,
  } = useRequest(() => getPostList({ page: 1, limit: 3 }), {
    immediate: true,
  });

  const recentPosts = computed<ILandingPost[]>(() => {
    return (postListData.value?.items ?? []).map(toLandingPost);
  });

  const hasPostError = computed<boolean>(() => Boolean(postsError.value));

  return {
    recentPosts,
    postsLoading,
    hasPostError,
  };
}
