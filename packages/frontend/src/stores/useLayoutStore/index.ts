import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useRoute } from 'vue-router';
import { useRequest } from 'alova/client';
import { getNavPages } from '@/api/page/getNavPages';
import { NAV_GROUPS } from '@/constants/nav';
import type { IPageNavItem, INavItemSource, INavItem } from '@/types/layout';
import type { INotification, INotificationOptions } from '@/types/notification';

/**
 * 布局 Store
 * 管理导航和 Footer 页面列表数据
 */
export const useLayoutStore = defineStore('layout', () => {
  const route = useRoute();

  /**
   * 使用 alova 的 useRequest 获取导航和 Footer 页面列表
   * 接口路径: GET /page/nav
   * 响应拦截器会自动提取 data 字段，返回 IPageNavItem[] 类型
   */
  const {
    loading,
    data: allPages,
    error,
    send: refresh,
  } = useRequest(getNavPages, {
    immediate: true, // 立即请求
    initialData: [],
  });

  /**
   * 从路由中获取 navGroup（支持继承，就近原则）
   * 从当前路由开始，向上遍历路由 matched 数组
   * 找到第一个配置了 navGroup 的路由
   * @returns navGroup 值，如果没有则返回 undefined
   */
  const getNavGroupFromRoute = (): string | undefined => {
    // 从当前路由开始，向上遍历 matched 数组（就近原则）
    for (let i = route.matched.length - 1; i >= 0; i--) {
      const matchedRoute = route.matched[i];
      if (matchedRoute && matchedRoute.meta?.navGroup) {
        return matchedRoute.meta.navGroup as string;
      }
    }
    return undefined;
  };

  const currentNavGroup = computed<string | undefined>(() => {
    return getNavGroupFromRoute();
  });

  /**
   * 将导航项源转换为导航项
   * @param source - 导航项源
   * @returns 导航项，如果无法解析则返回 null
   */
  const resolveNavItem = (source: INavItemSource): INavItem | null => {
    if (source.type === 'page') {
      // 从 allPages 中查找对应 slug 的页面
      const page = allPages.value?.find((p) => p.slug === source.slug);
      if (!page) {
        return null; // 页面不存在，过滤掉
      }
      return {
        id: `page-${page.id}`,
        title: source.title ?? page.title,
        to: `/${page.slug}.html`,
        type: 'page',
      };
    } else {
      // route 类型
      const routeValue =
        typeof source.route === 'string'
          ? source.route
          : source.route.name;
      return {
        id: `route-${routeValue}`,
        title: source.title,
        to: source.route,
        type: 'route',
      };
    }
  };

  /**
   * 导航页面列表（只读）
   * 根据当前路由的 navGroup 配置动态展示不同的导航页面组
   */
  const navPages = computed<INavItem[]>(() => {
    if (!allPages.value) {
      return [];
    }

    // 获取当前路由的 navGroup
    const navGroup = currentNavGroup.value;

    // 如果有 navGroup 且配置了对应页面组
    if (navGroup && NAV_GROUPS[navGroup]) {
      const groupConfig = NAV_GROUPS[navGroup];
      // 遍历配置的导航项源数组，转换为导航项
      return groupConfig
        .map((source) => resolveNavItem(source))
        .filter((item): item is INavItem => item !== null);
    }

    // 否则，按原逻辑过滤 showInNav === true 的页面，转换为 INavItem 格式

    const defaultNavPagePages = allPages.value
      .filter((page: IPageNavItem) => page.showInNav)
      .map((page: IPageNavItem) => ({
        id: `page-${page.id}`,
        title: page.title,
        to: `/${page.slug}.html`,
        type: 'page' as const,
      }))
    const defaultNavRoutePages = (NAV_GROUPS.default || []).map((source) => resolveNavItem(source)) as INavItem[]
    return [...defaultNavRoutePages, ...defaultNavPagePages];
  });

  /**
   * Footer 页面列表（只读）
   * 过滤 showInFooter === true 的页面
   */
  const footerPages = computed<IPageNavItem[]>(() => {
    if (!allPages.value) {
      return [];
    }
    return allPages.value.filter((page: IPageNavItem) => page.showInFooter);
  });

  /**
   * 完整的页面列表（只读）
   */
  const pages = computed<IPageNavItem[]>(() => {
    return allPages.value || [];
  });

  /**
   * 通知队列
   */
  const notifications = ref<INotification[]>([]);

  /**
   * 生成唯一通知 ID
   * @returns 唯一标识字符串
   */
  function generateNotificationId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 显示通知
   * @param options - 通知配置选项
   * @returns 通知 ID
   * 
   * 逻辑说明：
   * 1. 生成唯一 ID
   * 2. 设置默认值（closable: true, duration: 3000, type: 'info'）
   * 3. 将通知添加到队列
   * 4. 如果设置了 duration 且大于 0，自动在指定时间后移除
   */
  function notify(options: INotificationOptions): string {
    const id = generateNotificationId();
    const notification: INotification = {
      id,
      title: options.title,
      subtitle: options.subtitle,
      content: options.content,
      closable: options.closable ?? true,
      duration: options.duration ?? 3000,
      type: options.type ?? 'info',
    };

    notifications.value.push(notification);

    // 如果设置了 duration 且大于 0，自动移除
    const duration = notification.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }

  /**
   * 移除指定通知
   * @param id - 通知 ID
   * 
   * 逻辑说明：
   * 1. 从通知队列中查找并移除指定 ID 的通知
   */
  function removeNotification(id: string): void {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  }

  /**
   * 清空所有通知
   * 
   * 逻辑说明：
   * 1. 清空通知队列
   */
  function clearNotifications(): void {
    notifications.value = [];
  }

  return {
    // 只读的页面列表
    navPages,
    footerPages,
    allPages: pages,
    // 当前导航组
    currentNavGroup,
    // 加载状态
    loading,
    // 错误信息
    error,
    // 刷新方法，手动触发重新请求
    refresh,
    // 通知队列
    notifications,
    // 显示通知
    notify,
    // 移除通知
    removeNotification,
    // 清空所有通知
    clearNotifications,
  };
});

