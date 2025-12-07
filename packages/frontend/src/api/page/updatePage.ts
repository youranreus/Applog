import { alovaInstance } from '@/utils/alova';
import type { IPageDetail, IUpdatePageDto } from '@/types/page';

/**
 * 更新页面（局部更新）
 * 接口路径: PATCH /page/:id
 * @param id - 页面 ID
 * @param updateDto - 更新数据
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPageDetail - 拦截器处理后的实际返回数据类型
 * - TParams: { id: number; updateDto: IUpdatePageDto } - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPageDetail> - 原始响应结构（拦截器处理前）
 */
export const updatePage = (id: number, updateDto: IUpdatePageDto) => {
  return alovaInstance.Patch<IPageDetail, IUpdatePageDto>(
    `/page/${id}`,
    updateDto,
  );
};
