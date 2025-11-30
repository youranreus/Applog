import 'vue-router';
import type { UserRole } from '@/types/user';

/**
 * 路由 Meta 类型扩展
 * 用于在路由配置中定义权限要求
 */
declare module 'vue-router' {
  interface RouteMeta {
    /**
     * 是否需要登录
     * 设置为 true 时，未登录用户将被重定向到登录页
     */
    requiresAuth?: boolean;
    /**
     * 允许访问的角色列表
     * 如果配置了此字段，只有角色在列表中的用户才能访问
     * 需要配合 requiresAuth: true 使用
     */
    roles?: UserRole[];
    /**
     * 是否隐藏布局
     * 设置为 true 时，页面不显示 Header 和 Footer
     */
    hideLayout?: boolean;
  }
}

