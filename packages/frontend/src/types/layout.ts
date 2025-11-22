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

