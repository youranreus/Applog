import type { Method } from 'alova';
import { alovaInstance } from '@/utils/alova';
import type { IInitResponseDto } from '@/types/system-config';

/**
 * 初始化系统基础配置
 * 接口路径: POST /config/init
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IInitResponseDto - 拦截器处理后的实际返回数据类型
 * - TParams: unknown - 无请求参数
 * 
 * 注意：
 * - 需要管理员权限
 * - 防重复调用：如果系统已初始化则拒绝
 * - JWT token 会由请求拦截器自动添加
 * - 传递空对象 {} 作为 body，避免 Content-Type: application/json 时 body 为空导致的错误
 */
export const initializeSystem = () => {
  return alovaInstance.Post<IInitResponseDto>('/config/init', {});
};
