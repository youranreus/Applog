import { createAlova, type Method } from 'alova';
import VueHook from 'alova/vue';
import adapterFetch from 'alova/fetch';
import type { IRestfulResponse } from '@/types/api';
import { getToken } from './token';

/**
 * 创建 alova 实例
 * 配置基础 URL、请求适配器和响应拦截器
 * 
 * 请求拦截器会自动添加 JWT token 到请求头
 * 响应拦截器会自动处理 Restful 响应结构：
 * - 提取 data 字段作为实际返回数据
 * - 当 code !== 0 时抛出异常
 */
export const alovaInstance = createAlova({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  statesHook: VueHook,
  requestAdapter: adapterFetch(),
  /**
   * 请求拦截器
   * 自动从 localforage 读取 token 并添加到请求头
   * @param config - 请求配置对象
   * @returns 修改后的请求配置
   */
  beforeRequest: async (method: Method) => {
    const token = await getToken();

    if (token) {
      // 确保 headers 存在并且是可写的普通对象
      method.config.headers = method.config.headers || {};
      const headers = method.config.headers as Record<string, string>;
      if (!headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  },
  /**
   * 响应拦截器
   * 处理后端统一的 Restful 响应结构 { data, code, msg }
   * @param response - Fetch Response 对象
   * @returns 提取后的 data 字段，或原始响应数据
   * @throws {Error} 当 code !== 0 时抛出异常
   */
  responded: async (response) => {
    const json = await response.json();
    
    // 检查是否为 Restful 响应结构
    if (
      json &&
      typeof json === 'object' &&
      'code' in json &&
      'data' in json &&
      'msg' in json
    ) {
      const restfulResponse = json as IRestfulResponse<unknown>;
      
      // 当 code !== 0 时抛出异常
      if (restfulResponse.code !== 0) {
        throw new Error(restfulResponse.msg || '请求失败');
      }
      
      // 返回 data 字段作为实际数据
      return restfulResponse.data;
    }
    
    // 非 Restful 结构直接返回原始数据
    return json;
  },
  cacheFor: null,
});

