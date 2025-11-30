<script setup lang="ts">
import { useRoute } from 'vue-router';

/**
 * 路由实例
 */
const route = useRoute();

/**
 * 页面 Slug
 */
const pageSlug = route.params.slug as string;
</script>

<template>
  <div class="page-edit-page">
    <div class="page-header mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        {{ pageSlug ? '编辑页面' : '新建页面' }}
      </h1>
      <p class="text-gray-600">编辑系统页面内容</p>
    </div>

    <div class="page-edit-content">
      <div class="text-center text-gray-600 py-12">
        <p>页面编辑功能开发中...</p>
        <p v-if="pageSlug" class="text-sm mt-2">页面 Slug: {{ pageSlug }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-edit-page {
  width: 100%;
}

.page-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.page-edit-content {
  margin-top: 2rem;
}
</style>

