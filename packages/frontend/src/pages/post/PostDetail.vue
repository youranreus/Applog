<script setup lang="ts">
import { useRouter } from 'vue-router';
import { usePostDetail } from './hooks/usePostDetail';
import ArticleRenderer from '@/components/ui/article-renderer/ArticleRenderer.vue';
import Loading from '@/components/ui/loading/index.vue';
import { kButton, kChip } from 'konsta/vue';

const router = useRouter();
const { post, loading, error, formatDate } = usePostDetail();
</script>

<template>
  <div class="post-detail-page common-page-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center items-center py-8 sm:py-12 min-h-[400px]">
      <Loading />
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
      <h1 class="post-title mb-4 sm:mb-2">
        {{ post.title }}
      </h1>

      <!-- 元信息区 -->
      <div class="post-meta mb-6 sm:mb-8">
        <div class="meta-info flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-500 mb-3">
          <span v-if="post.createdAt" class="publish-date">
            {{ formatDate(post.createdAt) }}
          </span>
          <span v-if="post.createdAt && post.viewCount !== undefined" class="separator">•</span>
          <span v-if="post.viewCount !== undefined" class="view-count">
            {{ post.viewCount }} 次浏览
          </span>
          <span v-if="post.tags && post.tags.length > 0 && post.viewCount !== undefined" class="separator">•</span>
          <div v-if="post.tags && post.tags.length > 0" class="tags flex flex-wrap gap-2">
            <kChip
              v-for="tag in post.tags"
              :key="tag"
            >
              {{ tag }}
            </kChip>
          </div>
        </div>
      </div>

      <div v-if="post.summary" class="post-abstract">
        <p class="post-abstract-content">{{ post.summary }}</p>
      </div>

      <!-- 文章内容 -->
      <div class="post-content article-content">
        <ArticleRenderer :content="post.content" class="markdown-content" />
      </div>

      <div class="post-footer">
        もう終わりだよ。
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

/* 分隔线 */
.divider {
  @apply border-t border-gray-200;
}

/* 内容区域样式 */
.post-content {
  @apply my-6 min-h-[50vh];
}

.post-footer {
  @apply my-20 text-center opacity-10 text-2xl;
}

.post-abstract {
  @apply my-6 p-6 bg-gray-100 rounded-3xl relative overflow-hidden;
  &::before {
    content: '“';
    @apply absolute top-1 left-2 opacity-10 text-5xl;
  }
}

.post-abstract-content {
  @apply text-gray-500 italic;
}
</style>

