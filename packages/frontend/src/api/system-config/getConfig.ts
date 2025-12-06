import type { Method } from 'alova';
import { alovaInstance } from '@/utils/alova';
import type { IConfigResponseDto } from '@/types/system-config';
import { getSystemConfigKey, isSystemConfigKeySuffix } from '@applog/common';

/**
 * 获取系统配置项
 * 接口路径: GET /config/:key
 * @param key - 配置 key（如果是系统配置 key 后缀，会自动添加前缀）
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IConfigResponseDto | null - 拦截器处理后的实际返回数据类型
 * - TParams: { key: string } - 请求参数
 * 
 * 逻辑说明：
 * 1. 判断 key 是否为系统配置 key 后缀（如 SYSTEM_CONFIG_KEYS.BASE_CONFIG）
 * 2. 如果是系统配置 key，自动添加 SYSTEM_ 前缀
 * 3. 如果 key 已经包含前缀，直接使用
 * 
 * 注意：
 * - 普通配置：公开访问
 * - SYSTEM_ 配置：需要管理员权限（内部校验）
 * 
 * 示例：
 * - getConfig(SYSTEM_CONFIG_KEYS.BASE_CONFIG) => GET /config/SYSTEM_BASE_CONFIG
 * - getConfig('SYSTEM_BASE_CONFIG') => GET /config/SYSTEM_BASE_CONFIG
 * - getConfig('OTHER_KEY') => GET /config/OTHER_KEY
 */
export const getConfig = (key: string) => {
  // 如果是系统配置 key 后缀，自动添加前缀
  const fullKey = isSystemConfigKeySuffix(key) ? getSystemConfigKey(key) : key;
  return alovaInstance.Get<IConfigResponseDto | null>(`/config/${fullKey}`, { cacheFor: null });
};
