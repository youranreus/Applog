import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/Home.vue'),
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
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
