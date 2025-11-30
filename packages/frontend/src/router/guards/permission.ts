import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import { PERMISSION_ROUTES } from '@/constants/permission';

/**
 * 权限守卫
 * 在路由跳转前进行权限校验
 * 
 * 逻辑说明：
 * 1. 等待用户信息加载完成（通过 authInitPromise）
 * 2. 检查路由 meta.requiresAuth，如果不需要登录则放行
 * 3. 如果需要登录但用户未登录，跳转到登录页（携带 redirect 参数）
 * 4. 如果已登录，检查 meta.roles，如果配置了角色限制且用户角色不在允许列表中，跳转到 403 页面
 * 5. 其他情况放行
 * 
 * @param authInitPromise - 用户认证初始化 Promise，用于等待用户信息加载完成
 * @returns 导航守卫函数
 */
export function createPermissionGuard(
  authInitPromise: Promise<void>,
) {
  return async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext,
  ): Promise<void> => {
    // 等待用户信息加载完成
    try {
      await authInitPromise;
    } catch (error) {
      console.error('等待用户信息加载失败:', error);
      // 即使加载失败也继续，让后续逻辑处理
    }

    const userStore = useUserStore();
    const { requiresAuth, roles } = to.meta;

    // 如果路由不需要登录，直接放行
    if (!requiresAuth) {
      next();
      return;
    }

    // 需要登录但用户未登录，跳转到登录页
    if (!userStore.isAuthenticated) {
      const redirect = encodeURIComponent(to.fullPath);
      next({
        path: PERMISSION_ROUTES.LOGIN,
        query: { redirect },
      });
      return;
    }

    // 如果配置了角色限制，检查用户角色
    if (roles && roles.length > 0) {
      const userRole = userStore.user?.role;

      // 如果用户没有角色信息，跳转到 403 页面
      if (!userRole) {
        next({
          path: PERMISSION_ROUTES.FORBIDDEN,
        });
        return;
      }

      // 检查用户角色是否在允许的角色列表中
      if (!roles.includes(userRole)) {
        next({
          path: PERMISSION_ROUTES.FORBIDDEN,
        });
        return;
      }
    }

    // 所有检查通过，放行
    next();
  };
}

