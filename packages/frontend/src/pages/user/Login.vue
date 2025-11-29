<script setup lang="ts">
import { useUserStore } from '@/stores/useUserStore';

/**
 * 用户 Store
 */
const userStore = useUserStore();

/**
 * 处理登录按钮点击
 * 调用 userStore.login() 跳转到 SSO 登录页面
 */
function handleLogin(): void {
  try {
    userStore.login();
  } catch (error) {
    console.error('跳转 SSO 登录失败:', error);
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-md px-6 py-12 text-center">
      <!-- 用户图标 -->
      <div class="mb-8 flex justify-center">
        <ion-icon
          name="person-circle-outline"
          class="text-8xl text-muted-foreground"
        ></ion-icon>
      </div>

      <!-- 登录按钮 -->
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        @click="handleLogin"
      >
        前往 SSO 登录
      </button>
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

