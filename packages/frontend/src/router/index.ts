import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { createPermissionGuard } from './guards/permission';
import { ROUTE_NAMES, ROUTE_PERMISSIONS } from '@/constants/permission';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: ROUTE_NAMES.LANDING },
  },
  {
    path: '/landing',
    name: ROUTE_NAMES.LANDING,
    component: () => import('@/pages/Landing.vue'),
  },
  // /posts 路由组
  {
    path: '/posts',
    children: [
      {
        path: '',
        name: ROUTE_NAMES.POST_LIST,
        component: () => import('@/pages/post/PostList.vue'),
      },
      {
        path: ':slug',
        name: ROUTE_NAMES.POST_DETAIL,
        component: () => import('@/pages/post/PostDetail.vue'),
        props: true,
      },
    ],
  },
  // /page 路由组
  {
    path: '/page',
    children: [
      {
        path: ':slug',
        name: ROUTE_NAMES.PAGE_DETAIL,
        component: () => import('@/pages/page/PageDetail.vue'),
        props: true,
      },
    ],
  },
  // /user 路由组
  {
    path: '/user',
    meta: {
      navGroup: 'user',
    },
    children: [
      {
        path: 'login',
        name: ROUTE_NAMES.USER_LOGIN,
        component: () => import('@/pages/user/Login.vue'),
        meta: {
          hideLayout: true,
        },
      },
      {
        path: 'callback',
        name: ROUTE_NAMES.USER_CALLBACK,
        component: () => import('@/pages/user/Callback.vue'),
        meta: {
          hideLayout: true,
        },
      },
      {
        path: 'dashboard',
        name: ROUTE_NAMES.USER_DASHBOARD,
        component: () => import('@/pages/user/Dashboard/Dashboard.vue'),
        meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_DASHBOARD],
      },
      // /user/post 子路由组
      {
        path: 'post',
        children: [
          {
            path: '',
            name: ROUTE_NAMES.USER_POST_LIST,
            component: () => import('@/pages/user/PostList/PostList.vue'),
            meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_POST_LIST],
          },
          {
            path: 'create',
            name: ROUTE_NAMES.USER_POST_CREATE,
            component: () => import('@/pages/user/PostEdit/PostEdit.vue'),
            meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_POST_CREATE],
          },
          {
            path: 'edit/:slug',
            name: ROUTE_NAMES.USER_POST_EDIT,
            component: () => import('@/pages/user/PostEdit/PostEdit.vue'),
            props: true,
            meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_POST_EDIT],
          },
        ],
      },
      // /user/page 子路由组（管理员）
      {
        path: 'page',
        children: [
          {
            path: '',
            name: ROUTE_NAMES.USER_PAGE_LIST,
            component: () => import('@/pages/user/PageList/PageList.vue'),
            meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_PAGE_LIST],
          },
          {
            path: 'create',
            name: ROUTE_NAMES.USER_PAGE_CREATE,
            component: () => import('@/pages/user/PageEdit/PageEdit.vue'),
            meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_PAGE_CREATE],
          },
          {
            path: 'edit/:slug',
            name: ROUTE_NAMES.USER_PAGE_EDIT,
            component: () => import('@/pages/user/PageEdit/PageEdit.vue'),
            props: true,
            meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_PAGE_EDIT],
          },
        ],
      },
      {
        path: 'comment',
        name: ROUTE_NAMES.USER_COMMENT_LIST,
        component: () => import('@/pages/user/CommentList.vue'),
        meta: ROUTE_PERMISSIONS[ROUTE_NAMES.USER_COMMENT_LIST],
      },
    ],
  },
  // 错误页面
  {
    path: '/403',
    name: ROUTE_NAMES.FORBIDDEN,
    component: () => import('@/pages/error/Forbidden.vue'),
    meta: {
      hideLayout: true,
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

/**
 * 设置权限守卫
 * 需要在 main.ts 中调用，传入 authInitPromise
 * @param authInitPromise - 用户认证初始化 Promise
 */
export function setupPermissionGuard(authInitPromise: Promise<void>): void {
  router.beforeEach(createPermissionGuard(authInitPromise));
}

export default router;
