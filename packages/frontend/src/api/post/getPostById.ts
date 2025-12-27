import { alovaInstance } from '@/utils/alova';
import type { IPostDetail } from '@/types/post';

/**
 * 通过 slug 获取文章详情
 * 接口路径: GET /post/:slug
 * @param slug - 文章 slug
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPostDetail - 拦截器处理后的实际返回数据类型
 * - TParams: { slug: string } - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPostDetail> - 原始响应结构（拦截器处理前）
 */
export const getPostBySlug = (slug: string) => {
  return alovaInstance.Get<IPostDetail>(
    `/post/${slug}`,
  );
};
