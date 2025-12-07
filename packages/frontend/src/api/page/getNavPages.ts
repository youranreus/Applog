import type { Method } from 'alova';
import { alovaInstance } from '@/utils/alova';
import type { IPageNavItem } from '@/types/layout';
import type { IRestfulResponse } from '@/types/api';

/**
 * 获取导航和 Footer 页面列表
 * 接口路径: GET /page/nav
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPageNavItem[] - 拦截器处理后的实际返回数据类型
 * - TParams: unknown - 无请求参数
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPageNavItem[]> - 原始响应结构（拦截器处理前）
 */
export const getNavPages = ()=> {
  return alovaInstance.Get<IPageNavItem[]>(
    '/page/nav',
    {
      cacheFor: null
    }
  );
};

