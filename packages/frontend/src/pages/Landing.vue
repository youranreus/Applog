<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/constants/permission';

/**
 * 路由实例
 */
const router = useRouter();

/**
 * 跳转到文章列表页
 */
function goToPosts(): void {
  router.push({ name: ROUTE_NAMES.POST_LIST });
}
</script>

<template>
  <div class="landing-page">
    <div class="hero-section text-center py-16">
      <h1 class="text-5xl font-bold text-gray-900 mb-4">欢迎来到 AppLog</h1>
      <p class="text-xl text-gray-600 mb-8">分享知识，记录生活</p>
      <button
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        @click="goToPosts"
      >
        浏览文章
      </button>
    </div>

    <div class="content-section">
      <!-- 后续可以在这里添加更多内容 -->
    </div>
  </div>
</template>

<style scoped>
.landing-page {
  width: 100%;
}

.hero-section {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.content-section {
  margin-top: 4rem;
}
</style>
