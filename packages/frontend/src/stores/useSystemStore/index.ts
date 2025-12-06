import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useRequest } from 'alova/client';
import { SYSTEM_CONFIG_KEYS, type ISystemBaseConfig } from '@applog/common';
import { getConfig } from '@/api/system-config';

/**
 * 系统配置 Store
 * 管理系统基础配置数据
 */
export const useSystemStore = defineStore('system', () => {
  /**
   * 使用 alova 的 useRequest 获取系统基础配置
   * 接口路径: GET /config/SYSTEM_BASE_CONFIG
   * 响应拦截器会自动提取 data 字段，返回 IConfigResponseDto | null 类型
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
   * 自动解析 configValue 字段（JSON.parse），只返回解析后的 configValue 内容
   * 如果解析失败或没有值时返回 null
   */
  const config = computed<ISystemBaseConfig | null | undefined>(() => {
    if (!configData.value) {
      return null;
    }

    try {
      // 解析 configValue 字段
      // 当 configValue 为空字符串或不存在时返回 null
      const parsedValue = configData.value.configValue
        ? JSON.parse(configData.value.configValue)
        : null;

      return parsedValue as ISystemBaseConfig | null;
    } catch (error) {
      // JSON 解析失败时返回 null
      console.error('解析配置值失败:', error);
      return null;
    }
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
});

