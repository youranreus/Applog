<script setup lang="ts">
import { usePageList } from './hooks/usePageList';
import PageSearch from './components/PageSearch.vue';
import PageTable from './components/PageTable.vue';
import PagePagination from './components/PagePagination.vue';

/**
 * 使用页面列表 Hook 获取数据和状态
 */
const {
  pages,
  pagination,
  loading,
  error,
  setPage,
  setKeyword,
} = usePageList();

/**
 * 处理搜索
 * @param keyword - 搜索关键字
 */
function handleSearch(keyword: string): void {
  setKeyword(keyword);
}

/**
 * 处理页码变化
 * @param page - 目标页码
 */
function handlePageChange(page: number): void {
  setPage(page);
}
</script>

<template>
  <div class="page-list-page">
    <!-- 页面头部 -->
    <div class="page-header mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">页面管理</h1>
      <p class="text-gray-600">管理系统页面内容</p>
    </div>

    <!-- 搜索区域 -->
    <PageSearch
      :loading="loading"
      @search="handleSearch"
    />

    <!-- 错误状态 -->
    <div v-if="error" class="error-message">
      <p class="error-text">加载失败：{{ error.message || '未知错误' }}</p>
    </div>

    <!-- 表格区域 -->
    <PageTable
      :pages="pages"
      :loading="loading"
    />

    <!-- 分页区域 -->
    <div v-if="!error" class="pagination-wrapper">
      <PagePagination
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

.page-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.error-message {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
}

.error-text {
  color: #dc2626;
  font-size: 0.875rem;
}

.pagination-wrapper {
  margin-top: 1.5rem;
}
</style>
