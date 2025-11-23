import { alovaInstance } from '@/utils/alova';
import type { IPageDetail } from '@/types/page';

/**
 * 通过 slug 获取页面详情
 * 接口路径: GET /page/slug/:slug
 * @param slug - 页面 slug
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPageDetail - 拦截器处理后的实际返回数据类型
 * - TParams: { slug: string } - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPageDetail> - 原始响应结构（拦截器处理前）
 */
export const getPageBySlug = (slug: string) => {
  return alovaInstance.Get<IPageDetail>(
    `/page/slug/${slug}`,
  );
};

