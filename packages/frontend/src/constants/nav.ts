import type { INavItemSource } from '@/types/layout';
import { ROUTE_NAMES } from './permission';

/**
 * 导航页面组配置
 * key 为页面组标识，value 为该组包含的导航项源数组
 */
export const NAV_GROUPS: Record<string, INavItemSource[]> = {
  /**
   * 用户管理页面组
   * 在 /user/* 路径下展示的导航项
   */
  user: [
    {
      type: 'route',
      route: { name: ROUTE_NAMES.USER_DASHBOARD },
      title: '概览',
    },
    {
      type: 'route',
      route: { name: ROUTE_NAMES.USER_POST_LIST },
      title: '文章',
    },
    {
      type: 'route',
      route: { name: ROUTE_NAMES.USER_PAGE_LIST },
      title: '页面',
    },
    {
      type: 'route',
      route: { name: ROUTE_NAMES.USER_COMMENT_LIST },
      title: '评论',
    },
    // 可以添加页面类型的导航项
    // {
    //   type: 'page',
    //   slug: 'help',
    //   title: '帮助文档', // 可选，如果不提供则从页面数据获取
    // },
  ],
  default: [
    {
      type: 'route',
      route: { name: ROUTE_NAMES.LANDING },
      title: '首页',
    },
    {
      type: 'route',
      route: { name: ROUTE_NAMES.POST_LIST },
      title: '文章',
    },
    {
      type: 'route',
      route: { name: ROUTE_NAMES.NOTES },
      title: '笔记',
    },
    {
      type: 'route',
      route: { name: ROUTE_NAMES.GALLERY },
      title: '相册',
    },
  ],
};

export const SHOW_BACK_ROUTES: string[] = [
  ROUTE_NAMES.POST_DETAIL
]
