<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-md px-6 py-12">
      <Card>
        <CardContent>
          <div class="text-center">
            <h1 class="text-6xl font-bold mb-4">403</h1>
            <h2 class="text-2xl font-semibold mb-4">访问被拒绝</h2>
            <p class="text-sm text-muted-foreground mb-6">
              抱歉，您没有权限访问此页面
            </p>

            <Button class="w-full" @click="goHome">
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
