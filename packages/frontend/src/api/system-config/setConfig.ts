import type { Method } from 'alova';
import { alovaInstance } from '@/utils/alova';
import type { IConfigResponseDto } from '@/types/system-config';
import { getSystemConfigKey, SYSTEM_CONFIG_KEYS } from '@applog/common';

/**
 * 设置配置项的请求参数接口
 */
export interface ISetConfigParams {
  /** 配置 key（如果是系统配置 key 后缀，会自动添加前缀） */
  configKey: string;
  /** 配置值（JSON 字符串） */
  configValue: string;
  /** 配置描述（可选） */
  description?: string;
  /** 额外信息（可选） */
  extra?: Record<string, unknown>;
}

/**
 * 设置或创建系统配置项
 * 接口路径: PUT /config
 * @param params - 配置数据
 * @returns Method 对象，用于 alova 的 useRequest
 * 
 * 类型说明：
 * - TData: IConfigResponseDto - 拦截器处理后的实际返回数据类型
 * - TParams: ISetConfigParams - 请求参数
 * 
 * 逻辑说明：
 * 1. 判断 configKey 是否为系统配置 key 后缀（如 SYSTEM_CONFIG_KEYS.BASE_CONFIG）
 * 2. 如果是系统配置 key，自动添加 SYSTEM_ 前缀
 * 3. 如果 configKey 已经包含前缀，直接使用
 * 4. 将配置数据作为 body 发送到后端
 * 
 * 注意：
 * - 需要管理员权限（@AuthRoles('admin')）
 * - 普通配置：管理员可写
 * - SYSTEM_ 配置：管理员读写
 * - JWT token 会由请求拦截器自动添加
 * 
 * 示例：
 * - setConfig({ configKey: SYSTEM_CONFIG_KEYS.BASE_CONFIG, configValue: '...' }) => PUT /config (body: { configKey: 'SYSTEM_BASE_CONFIG', ... })
 * - setConfig({ configKey: 'SYSTEM_BASE_CONFIG', configValue: '...' }) => PUT /config (body: { configKey: 'SYSTEM_BASE_CONFIG', ... })
 */
export const setConfig = (params: ISetConfigParams) => {
  // 如果是系统配置 key 后缀，自动添加前缀
  const fullKey = params.configKey === SYSTEM_CONFIG_KEYS.BASE_CONFIG
    ? getSystemConfigKey(SYSTEM_CONFIG_KEYS.BASE_CONFIG)
    : params.configKey;

  return alovaInstance.Put<IConfigResponseDto>('/config', {
    configKey: fullKey,
    configValue: params.configValue,
    description: params.description,
    extra: params.extra,
  });
};

