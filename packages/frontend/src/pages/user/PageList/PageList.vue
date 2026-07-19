<script setup lang="ts">
import { computed, unref } from 'vue';
import { useRouter } from 'vue-router';
import { usePageList } from './hooks/usePageList';
import PageTable from './components/PageTable.vue';
import AdminPagination from '../components/AdminPagination.vue';
import AdminListHeader from '../components/AdminListHeader.vue';
import AdminListSearch from '../components/AdminListSearch.vue';
import AdminListError from '../components/AdminListError.vue';
import { ROUTE_NAMES } from '@/constants/permission';

/**
 * 使用页面列表 Hook 获取数据和状态
 */
const {
  pages,
  pagination,
  loading,
  error,
  queryParams,
  setPage,
  setKeyword,
  resetQuery,
  refresh,
} = usePageList();

const router = useRouter();

/**
 * 当前搜索关键字（回填搜索框）
 */
const keyword = computed(() => queryParams.value.keyword || '');

/**
 * 是否有生效中的搜索
 */
const hasKeyword = computed(() => Boolean(keyword.value.trim()));

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
 * 跳转新建页面
 */
function handleCreate(): void {
  router.push({ name: ROUTE_NAMES.USER_PAGE_CREATE });
}

/**
 * 重试加载
 */
function handleRetry(): void {
  refresh();
}
</script>

<template>
  <div class="page-list-page admin-page-container">
    <AdminListHeader
      title="我的页面"
      create-label="新建页面"
      :create-disabled="loading"
      @create="handleCreate"
    />

    <AdminListSearch
      :keyword="keyword"
      :loading="loading"
      label="搜索页面"
      placeholder="按标题搜索…"
      @search="handleSearch"
      @clear="handleClearSearch"
    />

    <AdminListError
      v-if="activeError"
      :message="errorMessage"
      :loading="loading"
      @retry="handleRetry"
    />

    <PageTable
      v-if="!activeError"
      :pages="pages"
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
.page-list-page {
  width: 100%;
}

.pagination-wrapper {
  margin-top: 1rem;
}
</style>
