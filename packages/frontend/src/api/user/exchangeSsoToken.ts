import type { Method } from 'alova';
import { alovaInstance } from '@/utils/alova';
import type { ILoginResponseDto } from '@/types/user';

/**
 * 交换 SSO ticket 为 token
 * 接口路径: GET /user/login
 * @param ticket - SSO 返回的 ticket
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: ILoginResponseDto - 拦截器处理后的实际返回数据类型
 * - TParams: { ticket: string } - 请求参数
 */
export const exchangeSsoToken = (ticket: string) => {
  return alovaInstance.Get<ILoginResponseDto>('/user/login', {
    params: {
      ticket,
    },
  });
};

