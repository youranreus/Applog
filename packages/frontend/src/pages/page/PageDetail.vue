<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import { usePageDetail } from '@/hooks/usePageDetail'
import { useImagePreview } from '@/hooks/useImagePreview'
import ArticleRenderer from '@/components/ui/article-renderer/ArticleRenderer.vue'
import ImagePreview from '@/components/ui/image-preview/ImagePreview.vue'
import Loading from '@/components/ui/loading/index.vue'

const route = useRoute()

/**
 * 从路由参数中获取页面 slug
 */
const slug = computed(() => route.params.slug as string)

/**
 * 使用页面详情 Hook 获取页面数据
 */
const { page, loading, error } = usePageDetail(slug)

const coverLoaded = ref(false)

const contentRef = ref<HTMLElement | null>(null)
const { previewVisible, previewSrc, previewAlt, closePreview } = useImagePreview(contentRef)

/**
 * 格式化日期
 * @param date - 日期字符串或 Date 对象
 * @returns 格式化后的日期字符串
 */
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="page-detail-page common-page-container">
    <!-- 加载状态 -->
    <template v-if="loading">
      <div class="text-center text-gray-600 py-12 min-h-[400px]">
        <Loading />
      </div>
    </template>

    <!-- 错误状态 -->
    <template v-else-if="error">
      <div class="state-block">
        <p class="state-label">无法加载页面</p>
        <pre class="state-error-block">{{ error.message || '未知错误' }}</pre>
      </div>
    </template>

    <!-- 页面内容 -->
    <template v-else-if="page">
      <div ref="contentRef">
        <!-- 封面图 -->
        <div v-if="page.cover" class="cover-block mb-6 sm:mb-8" :class="{ shimmer: !coverLoaded }">
          <img
            :src="page.cover"
            :alt="page.title"
            class="cover-block-image pointer-events-none"
            :class="{ loaded: coverLoaded }"
            @load="coverLoaded = true"
          />
        </div>

        <!-- 文章标题 -->
        <h1 class="gb-header">{{ page.title }}</h1>

        <!-- 摘要 -->
        <p v-if="page.summary" class="subheader gb-subheader">{{ page.summary }}</p>

        <!-- 正文内容 -->
        <ArticleRenderer :content="page.content" class="article-content" />

        <!-- 页面信息（底部） -->
        <div class="mod-date">
          <div v-if="page.author" class="mb-2">
            <span class="text-gray-600">作者：</span>
            <span>{{ page.author.name }}</span>
          </div>
          <div class="mb-2">
            <span class="text-gray-600">发布日期：</span>
            <span>{{ formatDate(page.createdAt) }}</span>
          </div>
          <div v-if="page.updatedAt && page.updatedAt !== page.createdAt" class="mb-2">
            <span class="text-gray-600">更新日期：</span>
            <span>{{ formatDate(page.updatedAt) }}</span>
          </div>
          <div class="mb-2">
            <span class="text-gray-600">浏览次数：</span>
            <span>{{ page.viewCount }} 次</span>
          </div>
          <div v-if="page.tags && page.tags.length > 0" class="mt-4">
            <span class="text-gray-600 mr-2">标签：</span>
            <span
              v-for="tag in page.tags"
              :key="tag"
              class="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded mr-2"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- 页面不存在 -->
    <template v-else>
      <div class="state-block">
        <p class="state-label">页面不存在。</p>
      </div>
    </template>

    <ImagePreview
      :visible="previewVisible"
      :src="previewSrc"
      :alt="previewAlt"
      @close="closePreview"
    />
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.page-detail-page {
  width: 100%;
  margin-top: 5vh;
}

@media (min-width: 640px) {
  .page-detail-page {
    margin-top: 10vh;
  }
}

.state-block {
  @apply my-20 text-center;
}

.state-label {
  @apply text-gray-400 text-xl mb-4;
}

.state-error-block {
  @apply inline-block text-left text-sm text-gray-500 bg-gray-50 rounded-xl px-5 py-3 mb-6 font-mono;
  max-width: 480px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
