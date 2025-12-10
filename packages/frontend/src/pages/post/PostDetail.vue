<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'
import { kButton } from 'konsta/vue'

const route = useRoute()
const postId = ref<string>('')

/**
 * 初始化页面
 * 从路由参数中获取文章 ID
 */
onMounted(() => {
  postId.value = route.params.id as string
})
</script>

<template>
  <div class="post-detail-page common-page-container">
    <div class="post-header mb-8">
      <k-button
        @click="$router.back()"
        class="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
      >
        <span>← 返回</span>
      </k-button>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">文章详情</h1>
      <p class="text-gray-600">文章 ID: {{ postId }}</p>
    </div>

    <div class="post-content">
      <div class="text-center text-gray-600 py-12">
        <p>文章详情功能开发中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-detail-page {
  width: 100%;
}

.post-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.post-content {
  margin-top: 2rem;
  line-height: 1.8;
}
</style>

