import { alovaInstance } from '@/utils/alova';
import type { IPageDetail, ICreatePageDto } from '@/types/page';

/**
 * 创建页面
 * 接口路径: POST /page
 * @param createDto - 创建页面的数据
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPageDetail - 拦截器处理后的实际返回数据类型
 * - TParams: ICreatePageDto - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPageDetail> - 原始响应结构（拦截器处理前）
 */
export const createPage = (createDto: ICreatePageDto) => {
  return alovaInstance.Post<IPageDetail, ICreatePageDto>(
    '/page',
    createDto,
  );
};
