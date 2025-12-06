import { computed } from 'vue';
import { useRequest } from 'alova/client';
import { SYSTEM_CONFIG_KEYS } from '@applog/common';
import { getConfig } from '@/api/system-config';
import type { IConfigResponseDto } from '@/types/system-config';

/**
 * 系统配置获取 Hook
 * 用于获取和管理系统基础配置数据
 * @returns 系统配置相关的状态和方法
 * 
 * 逻辑说明：
 * 1. 使用 useRequest 调用 getConfig API 获取 BASE_CONFIG 配置
 * 2. getConfig API 会自动识别系统配置 key 并添加 SYSTEM_ 前缀
 * 3. 立即请求配置数据
 * 4. 请求需要携带 JWT token（由请求拦截器自动添加）
 * 5. 返回加载状态、配置数据、错误信息和刷新方法
 */
export function useSystemConfig() {
  /**
   * 使用 alova 的 useRequest 获取系统基础配置
   * 接口路径: GET /config/SYSTEM_BASE_CONFIG
   */
  const {
    loading,
    data: configData,
    error,
    send: refreshConfig,
  } = useRequest(
    () => getConfig(SYSTEM_CONFIG_KEYS.BASE_CONFIG),
    {
      immediate: true, // 立即请求
    }
  );

  /**
   * 系统配置数据（只读）
   */
  const config = computed<IConfigResponseDto | null | undefined>(() => {
    return configData.value;
  });

  return {
    // 系统配置数据
    config,
    // 加载状态
    loading,
    // 错误信息
    error,
    // 刷新方法，手动触发重新请求
    refreshConfig,
  };
}

