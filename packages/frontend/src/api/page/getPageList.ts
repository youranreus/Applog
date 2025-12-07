import { alovaInstance } from '@/utils/alova';
import type { IPageListItem, IQueryPage, IPagination } from '@/types/page';

/**
 * 获取页面列表（支持分页、搜索、标签筛选）
 * 接口路径: GET /page
 * @param queryParams - 查询参数（page, limit, keyword, tags）
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IPagination<IPageListItem> - 拦截器处理后的实际返回数据类型
 * - TParams: IQueryPage - 请求参数类型
 * - THeaders: Headers - 请求头类型
 * - TResponse: IRestfulResponse<IPagination<IPageListItem>> - 原始响应结构（拦截器处理前）
 */
export const getPageList = (queryParams: IQueryPage) => {
  // 构建查询字符串
  const params = new URLSearchParams();
  
  if (queryParams.page !== undefined) {
    params.append('page', queryParams.page.toString());
  }
  
  if (queryParams.limit !== undefined) {
    params.append('limit', queryParams.limit.toString());
  }
  
  if (queryParams.keyword) {
    params.append('keyword', queryParams.keyword);
  }
  
  if (queryParams.tags && queryParams.tags.length > 0) {
    queryParams.tags.forEach((tag) => {
      params.append('tags', tag);
    });
  }
  
  const queryString = params.toString();
  const url = queryString ? `/page?${queryString}` : '/page';
  
  return alovaInstance.Get<IPagination<IPageListItem>>(url);
};
