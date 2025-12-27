import { alovaInstance } from '@/utils/alova';
import type { IPostDetail, IUpdatePostDto } from '@/types/post';

/**
 * 更新文章（局部更新）
 * 接口路径: PATCH /post/:slug
 * @param slug - 文章 slug
 * @param updateDto - 更新数据
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPostDetail - 拦截器处理后的实际返回数据类型
 * - TParams: { slug: string; updateDto: IUpdatePostDto } - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPostDetail> - 原始响应结构（拦截器处理前）
 */
export const updatePost = (slug: string, updateDto: IUpdatePostDto) => {
  return alovaInstance.Patch<IPostDetail, IUpdatePostDto>(
    `/post/${slug}`,
    updateDto,
  );
};
