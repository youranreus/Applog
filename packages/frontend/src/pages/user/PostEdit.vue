<script setup lang="ts">
import { useRoute } from 'vue-router';

/**
 * 路由实例
 */
const route = useRoute();

/**
 * 文章 ID
 */
const postId = route.params.id as string;
</script>

<template>
  <div class="post-edit-page">
    <div class="page-header mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        {{ postId ? '编辑文章' : '新建文章' }}
      </h1>
      <p class="text-gray-600">编辑您的文章内容</p>
    </div>

    <div class="post-edit-content">
      <div class="text-center text-gray-600 py-12">
        <p>文章编辑功能开发中...</p>
        <p v-if="postId" class="text-sm mt-2">文章 ID: {{ postId }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-edit-page {
  width: 100%;
}

.page-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.post-edit-content {
  margin-top: 2rem;
}
</style>

