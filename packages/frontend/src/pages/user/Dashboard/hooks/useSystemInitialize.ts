import { useRequest } from 'alova/client';
import { initializeSystem } from '@/api/system-config';

/**
 * 系统初始化 Hook
 * 用于处理系统初始化逻辑
 * @param refreshConfig - 刷新配置的方法，初始化成功后调用
 * @returns 系统初始化相关的状态和方法
 *
 * 逻辑说明：
 * 1. 使用 useRequest 调用 initializeSystem API
 * 2. 不立即请求，需要手动触发
 * 3. 初始化成功后调用 refreshConfig 重新获取配置
 * 4. 需要管理员权限（JWT token 由拦截器自动添加）
 * 5. 防重复调用：如果系统已初始化则拒绝
 */
export function useSystemInitialize(refreshConfig: () => Promise<void>) {
  /**
   * 使用 alova 的 useRequest 初始化系统
   * 接口路径: POST /config/init
   */
  const {
    loading,
    error,
    send: initRequest,
  } = useRequest(initializeSystem, {
    immediate: false,
  });

  /**
   * 从请求错误中提取可读消息
   * @param err - 未知错误对象
   * @returns 面向用户的错误文案
   */
  function getErrorMessage(err: unknown): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return '系统初始化失败，请稍后重试';
  }

  /**
   * 处理系统初始化
   * 调用初始化接口，成功后重新获取配置
   * @returns 成功时 resolve，失败时 reject（错误信息同时写入 useRequest.error）
   */
  async function handleInitialize(): Promise<void> {
    try {
      await initRequest();
      await refreshConfig();
    } catch (err) {
      console.error('系统初始化失败:', err);
      throw err instanceof Error ? err : new Error(getErrorMessage(err));
    }
  }

  return {
    loading,
    error,
    handleInitialize,
    getErrorMessage,
  };
}
