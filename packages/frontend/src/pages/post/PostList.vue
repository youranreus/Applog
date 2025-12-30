<script setup lang="ts">
import { useRouter } from 'vue-router';
import { usePostList } from './hooks/usePostList';
import Pagination from '@/components/ui/pagination/index.vue';
import Loading from '@/components/ui/loading/index.vue';
import { ROUTE_NAMES } from '@/constants/permission';

const router = useRouter();
const { posts, pagination, loading, handlePageChange, formatDate } = usePostList();

/**
 * 跳转到文章详情页
 * @param slug - 文章 slug
 */
function goToPostDetail(slug: string): void {
  router.push({
    name: ROUTE_NAMES.POST_DETAIL,
    params: { slug },
  });
}
</script>

<template>
  <div class="post-list-page common-page-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center items-center py-8 sm:py-12 min-h-[400px]">
      <Loading />
    </div>

    <!-- 文章列表 -->
    <div v-else-if="posts.length > 0" class="post-list">
      <article
        v-for="post in posts"
        :key="post.id"
        class="post-item group/article"
        @click="goToPostDetail(post.slug)"
      >
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 relative">
          <!-- 左侧：标题 -->
          <div class="flex-1 min-w-0 relative z-10 transition-all group-hover/article:text-blue-500">
            <h2 class="text-base sm:text-lg font-bold leading-snug">
              {{ post.title }}
            </h2>
          </div>

          <!-- 右侧：日期和标签 -->
          <div class="flex items-center gap-2 sm:gap-3 shrink-0 relative z-10">
            <p class="text-xs sm:text-sm text-gray-500 whitespace-nowrap leading-snug">
              {{ formatDate(post.createdAt) }}
            </p>
          </div>
        </div>
      </article>

      <!-- 分页组件 -->
      <div v-if="pagination && pagination.totalPages > 1" class="mt-6 sm:mt-8">
        <Pagination
          :current-page="pagination.currentPage"
          :total-pages="pagination.totalPages"
          :on-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-center text-gray-600 py-8 sm:py-12">
      <p class="text-sm sm:text-base">暂无文章</p>
    </div>
  </div>
</template>

<style scoped>
@reference 'tailwindcss';

.post-list-page {
  width: 100%;
  margin-top: 5vh;
}

@media (min-width: 640px) {
  .post-list-page {
    margin-top: 10vh;
  }
}

.post-list {
  @apply mt-0 flex flex-col gap-8;
}

.post-item {
  @apply cursor-pointer relative;
}
</style>

