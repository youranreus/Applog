<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import type { ISsoCallbackParams } from '@/types/user';
import Button from '@/components/ui/button/index.vue';
import { kCard } from 'konsta/vue';

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
  <div class="min-h-screen flex items-center justify-center bg-ios-light-surface">
    <div class="w-full max-w-md px-6 py-12">
      <k-card>
        <h2 class="text-2xl font-bold mb-4">登录</h2>

        <p v-if="!error" class="text-sm text-muted-foreground">
          正在处理登录...
        </p>
        <template v-else>
          <p class="mb-4 text-red-600">{{ error }}</p>

          <Button
            rounded
            class="w-full"
            @click="handleCallback"
          >
            重试
          </Button>
        </template>
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

