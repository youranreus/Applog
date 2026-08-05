<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useUserStore } from '@/stores/useUserStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { normalizeReturnPath } from '@/utils/normalize-return-path';

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
 * 调用 userStore.login() 跳转到后端托管的 OIDC 登录入口
 * 如果 URL 中有 redirect 参数，将规范化后的站内路径绑定到后端 OIDC transaction
 */
function handleLogin(): void {
  try {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : undefined;
    userStore.login(normalizeReturnPath(redirect));
  } catch (error) {
    console.error('跳转 OIDC 登录失败:', error);
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-md px-6 py-12">
      <Card>
        <CardContent>
          <h2 class="text-2xl font-bold mb-4">登录</h2>

          <p class="text-sm text-muted-foreground mb-4">
            使用 H 账号登录，授权完成后会返回这里
          </p>

          <Button class="w-full" @click="handleLogin">
            下一步
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
