import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'postList' },
  },
  {
    path: '/posts',
    name: 'postList',
    component: () => import('@/pages/post/PostList.vue'),
  },
  {
    path: '/posts/:id',
    name: 'postDetail',
    component: () => import('@/pages/post/PostDetail.vue'),
    props: true,
  },
  {
    path: '/page/:slug',
    name: 'pageDetail',
    component: () => import('@/pages/page/PageDetail.vue'),
    props: true,
  },
  {
    path: '/user/login',
    name: 'userLogin',
    component: () => import('@/pages/user/Login.vue'),
    meta: {
      hideLayout: true,
    },
  },
  {
    path: '/user/callback',
    name: 'userCallback',
    component: () => import('@/pages/user/Callback.vue'),
    meta: {
      hideLayout: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
