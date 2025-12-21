<script setup lang="ts">
import { useRouter } from 'vue-router';
import { usePostDetail } from './hooks/usePostDetail';
import MarkdownRenderer from '@/components/ui/markdown-renderer/MarkdownRenderer.vue';
import { kButton } from 'konsta/vue';

const router = useRouter();
const { post, loading, error, formatDate } = usePostDetail();
</script>

<template>
  <div class="post-detail-page common-page-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center items-center py-8 sm:py-12">
      <p class="text-sm sm:text-base text-gray-600">加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="text-center text-gray-600 py-8 sm:py-12">
      <p class="text-sm sm:text-base mb-4">加载文章失败，请稍后重试</p>
      <k-button
        @click="router.back()"
        class="text-gray-600 hover:text-gray-900 inline-flex items-center"
      >
        <span>← 返回</span>
      </k-button>
    </div>

    <!-- 文章内容 -->
    <article v-else-if="post" class="post-article">
      <!-- 封面图 -->
      <div v-if="post.cover" class="post-cover mb-6 sm:mb-8">
        <img
          :src="post.cover"
          :alt="post.title"
          class="cover-image"
        />
      </div>

      <!-- 文章标题 -->
      <h1 class="post-title mb-4 sm:mb-6">
        {{ post.title }}
      </h1>

      <!-- 元信息区 -->
      <div class="post-meta mb-6 sm:mb-8">
        <div class="meta-info flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-500 mb-3">
          <span v-if="post.author" class="author-name">
            {{ post.author.name }}
          </span>
          <span v-if="post.author && post.createdAt" class="separator">•</span>
          <span v-if="post.createdAt" class="publish-date">
            {{ formatDate(post.createdAt) }}
          </span>
          <span v-if="post.createdAt && post.viewCount !== undefined" class="separator">•</span>
          <span v-if="post.viewCount !== undefined" class="view-count">
            {{ post.viewCount }} 次浏览
          </span>
        </div>

        <!-- 标签 -->
        <div v-if="post.tags && post.tags.length > 0" class="tags flex flex-wrap gap-2">
          <span
            v-for="tag in post.tags"
            :key="tag"
            class="tag"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="divider mb-6 sm:mb-8"></div>

      <!-- 文章内容 -->
      <div class="post-content">
        <MarkdownRenderer :content="post.content" class="markdown-content" />
      </div>
    </article>

    <!-- 文章不存在 -->
    <div v-else class="text-center text-gray-600 py-8 sm:py-12">
      <p class="text-sm sm:text-base mb-4">文章不存在</p>
      <k-button
        @click="router.back()"
        class="text-gray-600 hover:text-gray-900 inline-flex items-center"
      >
        <span>← 返回</span>
      </k-button>
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.post-detail-page {
  width: 100%;
  margin-top: 5vh;
}

@media (min-width: 640px) {
  .post-detail-page {
    margin-top: 10vh;
  }
}

.post-article {
  width: 100%;
}

/* 封面图样式 */
.post-cover {
  width: 100%;
  overflow: hidden;
  border-radius: 0.5rem;
  box-shadow: 0 9px 20px 0 rgba(46,35,94,0.07);
}

.cover-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  aspect-ratio: 16 / 9;
}

/* 文章标题样式 */
.post-title {
  @apply text-3xl font-bold text-gray-900 leading-tight;
}

@media (min-width: 640px) {
  .post-title {
    @apply text-4xl;
  }
}

/* 元信息样式 */
.post-meta {
  @apply text-sm;
}

.meta-info {
  @apply text-gray-500;
}

.separator {
  @apply text-gray-400;
}

.author-name {
  @apply font-medium;
}

.publish-date,
.view-count {
  @apply text-gray-500;
}

/* 标签样式 */
.tags {
  @apply mt-2;
}

.tag {
  @apply px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded;
}

/* 分隔线 */
.divider {
  @apply border-t border-gray-200;
}

/* 内容区域样式 */
.post-content {
  @apply mt-6;
}

.markdown-content {
  @apply text-gray-900 leading-relaxed;
  line-height: 1.8;
}

/* Markdown 内容样式优化 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  @apply font-bold text-gray-900 mt-6 mb-4;
}

.markdown-content :deep(h1) {
  @apply text-3xl;
}

.markdown-content :deep(h2) {
  @apply text-2xl;
}

.markdown-content :deep(h3) {
  @apply text-xl;
}

.markdown-content :deep(p) {
  @apply mb-4;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  @apply mb-4 pl-6;
}

.markdown-content :deep(li) {
  @apply mb-2;
}

.markdown-content :deep(blockquote) {
  @apply border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4;
}

.markdown-content :deep(code) {
  @apply bg-gray-100 px-1 py-0.5 rounded text-sm font-mono;
}

.markdown-content :deep(pre) {
  @apply bg-gray-100 p-4 rounded overflow-x-auto mb-4;
}

.markdown-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.markdown-content :deep(a) {
  @apply text-blue-600 underline hover:text-blue-800;
}

.markdown-content :deep(img) {
  @apply max-w-full h-auto rounded my-4;
}

.markdown-content :deep(table) {
  @apply w-full border-collapse border border-gray-300 mb-4;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  @apply border border-gray-300 px-4 py-2;
}

.markdown-content :deep(th) {
  @apply bg-gray-100 font-bold;
}
</style>

