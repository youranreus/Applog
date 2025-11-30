<script setup lang="ts">
import { useRouter } from 'vue-router';
import { kCard } from 'konsta/vue';
import Button from '@/components/ui/button/index.vue';

/**
 * 路由实例
 */
const router = useRouter();

/**
 * 返回首页
 */
function goHome(): void {
  router.push('/posts');
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-ios-light-surface">
    <div class="w-full max-w-md px-6 py-12">
      <k-card>
        <div class="text-center">
          <h1 class="text-6xl font-bold mb-4">403</h1>
          <h2 class="text-2xl font-semibold mb-4">访问被拒绝</h2>
          <p class="text-sm text-muted-foreground mb-6">
            抱歉，您没有权限访问此页面
          </p>

          <!-- 返回首页按钮 -->
          <Button rounded class="w-full" @click="goHome">
            返回首页
          </Button>
        </div>
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

