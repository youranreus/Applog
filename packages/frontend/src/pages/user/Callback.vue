<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import type { ISsoCallbackParams } from '@/types/user';

/**
 * 路由实例
 */
const route = useRoute();
const router = useRouter();

/**
 * 用户 Store
 */
const userStore = useUserStore();

/**
 * 错误信息
 */
const error = ref<string | null>(null);

/**
 * 处理 SSO 回调
 * 从 URL 参数中获取 code，调用 userStore.handleSsoCallback() 处理登录
 * 成功后跳转到首页，失败则显示错误信息
 */
async function handleCallback(): Promise<void> {
  try {
    // 从 URL 参数中获取 code
    const code = route.query.code as string | undefined;
    const state = route.query.state as string | undefined;

    if (!code) {
      throw new Error('缺少 SSO 回调参数 code');
    }

    // 构建回调参数
    const params: ISsoCallbackParams = {
      code,
      ...(state && { state }),
    };

    // 调用 userStore 处理 SSO 回调
    await userStore.handleSsoCallback(params);

    // 成功后跳转到首页
    await router.push('/');
  } catch (err) {
    console.error('处理 SSO 回调失败:', err);
    error.value = err instanceof Error ? err.message : '处理 SSO 回调失败';
  }
}

/**
 * 组件挂载时自动处理回调
 */
onMounted(() => {
  handleCallback();
});
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

      <!-- Loading 状态 -->
      <div v-if="!error" class="space-y-4">
        <div class="flex justify-center">
          <div
            class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          ></div>
        </div>
        <p class="text-muted-foreground">正在处理登录...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else class="space-y-4">
        <p class="text-destructive">{{ error }}</p>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          @click="handleCallback"
        >
          重试
        </button>
      </div>
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

