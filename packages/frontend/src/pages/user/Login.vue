<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import { kCard } from 'konsta/vue';
import Button from '@/components/ui/button/index.vue';

/**
 * 路由实例
 */
const route = useRoute();

/**
 * 用户 Store
 */
const userStore = useUserStore();

/**
 * 处理登录按钮点击
 * 调用 userStore.login() 跳转到 SSO 登录页面
 * 如果 URL 中有 redirect 参数，保存到 sessionStorage，登录成功后跳转回原页面
 */
function handleLogin(): void {
  try {
    // 如果 URL 中有 redirect 参数，保存到 sessionStorage
    const redirect = route.query.redirect as string | undefined;
    if (redirect) {
      sessionStorage.setItem('login_redirect', redirect);
    }

    userStore.login();
  } catch (error) {
    console.error('跳转 SSO 登录失败:', error);
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-ios-light-surface">
    <div class="w-full max-w-md px-6 py-12">
      <k-card>
        <h2 class="text-2xl font-bold mb-4">登录</h2>

        <p class="text-sm text-muted-foreground mb-4">
          嘿，我们使用 SSO 登录，点击下一步按钮进行登录
        </p>

        <!-- 登录按钮 -->
        <Button rounded class="w-full" @click="handleLogin">
          下一步
        </Button>
      </k-card>
    </div>
  </div>
</template>

<style scoped>
/* 确保 ion-icon 正确显示 */
ion-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
}
</style>

