import type { Method } from 'alova';
import { alovaInstance } from '@/utils/alova';
import type { IUserResponseDto } from '@/types/user';

/**
 * 获取当前登录用户信息
 * 接口路径: GET /user/data
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IUserResponseDto - 拦截器处理后的实际返回数据类型
 * - TParams: unknown - 无请求参数
 * 
 * 注意：此接口需要携带 JWT token 进行认证
 */
export const getUserInfo = () => {
  return alovaInstance.Get<IUserResponseDto>('/user/data');
};

