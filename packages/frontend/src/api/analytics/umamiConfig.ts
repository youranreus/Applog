import { alovaInstance } from '@/utils/alova';
import type { IUmamiConfig } from '@applog/common';

/**
 * 获取脱敏后的 Umami 对接配置（管理员）
 * 接口路径: GET /analytics/umami-config
 * @returns Method，返回脱敏配置
 */
export const getUmamiConfig = () => {
  return alovaInstance.Get<IUmamiConfig>('/analytics/umami-config');
};

/**
 * 保存 Umami 对接配置（管理员）
 * 接口路径: PUT /analytics/umami-config
 * @param payload - 表单配置（空密码表示不修改）
 * @returns Method，返回脱敏后的最新配置
 */
export const setUmamiConfig = (payload: IUmamiConfig) => {
  return alovaInstance.Put<IUmamiConfig>('/analytics/umami-config', payload);
};
