import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { MotionPlugin } from '@vueuse/motion';

import App from './App.vue';
import router, { setupPermissionGuard } from './router';
import { useUserStore } from './stores/useUserStore';
import './assets/base.css';
import '@/assets/main.scss';
// 初始化 alova 实例
import '@/utils/alova';

const app = createApp(App);

app.use(createPinia());
app.use(MotionPlugin);

/**
 * 初始化用户认证状态
 * 在应用挂载前调用，确保路由守卫可以等待用户信息加载完成
 */
const userStore = useUserStore();
const authInitPromise = userStore.initializeAuth();

// 设置权限守卫，传入 authInitPromise 供守卫等待
setupPermissionGuard(authInitPromise);

app.use(router);

app.mount('#app');
