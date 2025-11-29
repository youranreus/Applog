/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 */
interface ImportMetaEnv {
  /**
   * SSO 登录页面 URL
   */
  readonly VITE_SSO_LOGIN_URL: string;
  /**
   * SSO 回调 URL
   */
  readonly VITE_SSO_CALLBACK_URL: string;
  /**
   * SSO 客户端 ID
   */
  readonly VITE_SSO_CLIENT_ID: string;
  /**
   * 后端 API 基础 URL
   */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * 扩展 Vue Router 的 RouteMeta 接口
 * 使用全局类型声明来扩展，避免覆盖模块导出
 */
import type { RouteMeta as VueRouterRouteMeta } from 'vue-router';

declare module 'vue-router' {
   
  interface RouteMeta extends VueRouterRouteMeta {
    /**
     * 是否隐藏布局（Header/Footer）
     * 设置为 true 时，页面将不显示 Header 和 Footer
     */
    hideLayout?: boolean;
  }
}
