import { alovaInstance } from '@/utils/alova';
import type { IPostDetail, ICreatePostDto } from '@/types/post';

/**
 * 创建文章
 * 接口路径: POST /post
 * @param createDto - 创建文章的数据
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPostDetail - 拦截器处理后的实际返回数据类型
 * - TParams: ICreatePostDto - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPostDetail> - 原始响应结构（拦截器处理前）
 */
export const createPost = (createDto: ICreatePostDto) => {
  return alovaInstance.Post<IPostDetail, ICreatePostDto>(
    '/post',
    createDto,
  );
};
