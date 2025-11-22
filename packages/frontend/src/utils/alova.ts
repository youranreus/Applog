import { createAlova } from 'alova';
import VueHook from 'alova/vue';
import adapterFetch from 'alova/fetch';

/**
 * 创建 alova 实例
 * 配置基础 URL、请求适配器和响应拦截器
 */
export const alovaInstance = createAlova({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  statesHook: VueHook,
  requestAdapter: adapterFetch(),
  responded: (response) => response.json(),
});

