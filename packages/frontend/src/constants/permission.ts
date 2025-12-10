/**
 * 用户角色常量
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

/**
 * 权限相关路由常量
 */
export const PERMISSION_ROUTES = {
  LOGIN: '/user/login',
  FORBIDDEN: '/403',
  HOME: '/posts',
} as const;

/**
 * 路由名称常量
 */
export const ROUTE_NAMES = {
  // 公开页面
  LANDING: 'landing',
  POST_LIST: 'postList',
  POST_DETAIL: 'postDetail',
  PAGE_DETAIL: 'pageDetail',

  // 用户相关（需要登录）
  USER_LOGIN: 'userLogin',
  USER_CALLBACK: 'userCallback',
  USER_DASHBOARD: 'userDashboard',
  USER_POST_LIST: 'userPostList',
  USER_POST_CREATE: 'userPostCreate',
  USER_POST_EDIT: 'userPostEdit',

  // 管理员相关
  USER_PAGE_LIST: 'userPageList',
  USER_PAGE_CREATE: 'userPageCreate',
  USER_PAGE_EDIT: 'userPageEdit',
  USER_COMMENT_LIST: 'userCommentList',

  // 错误页
  FORBIDDEN: 'forbidden',
} as const;

import type { RouteMeta } from 'vue-router';

/**
 * 权限配置映射
 * 用于在路由配置中快速应用权限要求
 */
export const ROUTE_PERMISSIONS: Record<string, RouteMeta> = {
  [ROUTE_NAMES.USER_DASHBOARD]: { requiresAuth: true },
  [ROUTE_NAMES.USER_POST_LIST]: { requiresAuth: true, roles: ['admin'] },
  [ROUTE_NAMES.USER_POST_CREATE]: { requiresAuth: true, roles: ['admin'] },
  [ROUTE_NAMES.USER_POST_EDIT]: { requiresAuth: true, roles: ['admin'] },
  [ROUTE_NAMES.USER_PAGE_LIST]: { requiresAuth: true, roles: ['admin'] },
  [ROUTE_NAMES.USER_PAGE_CREATE]: { requiresAuth: true, roles: ['admin'] },
  [ROUTE_NAMES.USER_PAGE_EDIT]: { requiresAuth: true, roles: ['admin'] },
  [ROUTE_NAMES.USER_COMMENT_LIST]: { requiresAuth: true, roles: ['admin'] },
};

