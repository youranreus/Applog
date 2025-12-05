/**
 * 导航/Footer页面项类型
 * 对应后端的 IPageNavItemDto
 */
export interface IPageNavItem {
  id: number;
  title: string;
  slug: string;
  showInNav: boolean;
  showInFooter: boolean;
}

/**
 * 导航项源类型（配置中的抽象实体）
 * 可以是 Page（通过 slug）或 Route（通过路由名称或路径）
 */
export type INavItemSource =
  | {
      type: 'page';
      slug: string;
      title?: string; // 如果不提供则从页面数据获取
    }
  | {
      type: 'route';
      route: string | { name: string };
      title: string; // route 类型必须提供 title
    };

/**
 * 导航项类型（最终渲染的导航项）
 */
export interface INavItem {
  id: string; // 唯一标识
  title: string; // 显示标题
  to: string | { name: string }; // 链接目标（page 为路径字符串，route 为路由名称对象或路径字符串）
  type: 'page' | 'route'; // 类型标识
}

