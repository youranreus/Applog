<script setup lang="ts">
import { computed, unref } from 'vue';
import { useRouter } from 'vue-router';
import { usePostList } from './hooks/usePostList';
import PostTable from './components/PostTable.vue';
import AdminPagination from '../components/AdminPagination.vue';
import AdminListHeader from '../components/AdminListHeader.vue';
import AdminListSearch from '../components/AdminListSearch.vue';
import AdminListError from '../components/AdminListError.vue';
import { ROUTE_NAMES } from '@/constants/permission';

/**
 * 使用文章列表 Hook 获取数据和状态
 */
const {
  posts,
  pagination,
  loading,
  error,
  keyword,
  setPage,
  setKeyword,
  resetQuery,
  refresh,
} = usePostList();

const router = useRouter();

/**
 * 是否有生效中的搜索
 */
const hasKeyword = computed(() => Boolean(unref(keyword)?.trim()));

/**
 * 当前错误对象（兼容 Ref / 裸 Error）
 */
const activeError = computed(() => unref(error));

/**
 * 错误人话文案
 */
const errorMessage = computed(() => {
  const current = activeError.value;
  if (!current) {
    return '';
  }
  const raw = current.message?.trim();
  return raw ? `加载失败：${raw}` : '加载失败，请稍后重试。';
});

/**
 * 处理搜索
 * @param nextKeyword - 搜索关键字
 */
function handleSearch(nextKeyword: string): void {
  setKeyword(nextKeyword);
}

/**
 * 清除搜索与筛选
 */
function handleClearSearch(): void {
  resetQuery();
}

/**
 * 处理页码变化
 * @param page - 目标页码
 */
function handlePageChange(page: number): void {
  setPage(page);
}

/**
 * 跳转新建文章
 */
function handleCreate(): void {
  router.push({ name: ROUTE_NAMES.USER_POST_CREATE });
}

/**
 * 重试加载
 */
function handleRetry(): void {
  refresh();
}
</script>

<template>
  <div class="post-list-page admin-page-container">
    <AdminListHeader
      title="我的文章"
      create-label="写新文章"
      :create-disabled="loading"
      @create="handleCreate"
    />

    <AdminListSearch
      :keyword="keyword || ''"
      :loading="loading"
      label="搜索文章"
      placeholder="按标题或摘要搜索…"
      @search="handleSearch"
      @clear="handleClearSearch"
    />

    <AdminListError
      v-if="activeError"
      :message="errorMessage"
      :loading="loading"
      @retry="handleRetry"
    />

    <PostTable
      v-if="!activeError"
      :posts="posts"
      :loading="loading"
      :has-keyword="hasKeyword"
      @create="handleCreate"
      @clear-search="handleClearSearch"
    />

    <div
      v-if="!activeError"
      class="pagination-wrapper"
    >
      <AdminPagination
        :pagination="pagination"
        :loading="loading"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.post-list-page {
  width: 100%;
}

.pagination-wrapper {
  margin-top: 1rem;
}
</style>
