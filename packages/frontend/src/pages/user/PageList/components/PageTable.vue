<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { IPageListItem } from '@/types/page';
import Loading from '@/components/ui/loading/index.vue';
import { ROUTE_NAMES } from '@/constants/permission';

/**
 * Props 定义
 */
interface Props {
  /** 页面列表数据 */
  pages: IPageListItem[];
  /** 是否正在加载 */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pages: () => [],
  loading: false,
});

/**
 * 路由实例
 */
const router = useRouter();

/**
 * 是否有数据
 */
const hasData = computed(() => {
  return props.pages.length > 0;
});

/**
 * 格式化日期
 * @param date - 日期对象或字符串
 * @returns 格式化后的日期字符串
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 获取状态标签样式
 * @param status - 页面状态
 * @returns 状态标签的 CSS 类名
 */
function getStatusClass(status: 'draft' | 'published' | 'archived'): string {
  const statusMap = {
    draft: 'status-draft',
    published: 'status-published',
    archived: 'status-archived',
  };
  return statusMap[status] || '';
}

/**
 * 获取状态文本
 * @param status - 页面状态
 * @returns 状态文本
 */
function getStatusText(status: 'draft' | 'published' | 'archived'): string {
  const statusMap = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  };
  return statusMap[status] || status;
}

/**
 * 跳转到编辑页面
 * @param slug - 页面 slug
 */
function handleRowClick(slug: string): void {
  router.push({
    name: ROUTE_NAMES.USER_PAGE_EDIT,
    params: { slug },
  });
}
</script>

<template>
  <div class="page-table">
    <!-- 加载状态 -->
    <div v-if="loading" class="table-loading">
      <Loading :size="48" />
    </div>

    <!-- 表格内容 -->
    <div v-else-if="hasData" class="table-container">
      <table class="table">
        <thead class="table-header">
          <tr>
            <th class="table-header-cell">标题</th>
            <th class="table-header-cell">Slug</th>
            <th class="table-header-cell">状态</th>
            <th class="table-header-cell">浏览次数</th>
            <th class="table-header-cell">创建时间</th>
          </tr>
        </thead>
        <tbody class="table-body">
          <tr
            v-for="page in pages"
            :key="page.id"
            class="table-row"
            @click="handleRowClick(page.slug)"
          >
            <td class="table-cell table-cell-title">
              <div class="cell-title-wrapper">
                <span class="cell-title">{{ page.title }}</span>
                <span v-if="page.showInNav" class="cell-badge badge-nav">导航</span>
                <span v-if="page.showInFooter" class="cell-badge badge-footer">Footer</span>
              </div>
            </td>
            <td class="table-cell table-cell-slug">
              <code class="cell-slug">{{ page.slug }}</code>
            </td>
            <td class="table-cell table-cell-status">
              <span :class="['status-badge', getStatusClass(page.status)]">
                {{ getStatusText(page.status) }}
              </span>
            </td>
            <td class="table-cell table-cell-views">
              {{ page.viewCount }}
            </td>
            <td class="table-cell table-cell-date">
              {{ formatDate(page.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 空状态 -->
    <div v-else class="table-empty">
      <p class="empty-text">暂无页面数据</p>
    </div>
  </div>
</template>

<style scoped>
.page-table {
  width: 100%;
  background-color: #ffffff;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.table-loading,
.table-empty {
  padding: 3rem 1.5rem;
  text-align: center;
}

.loading-text,
.empty-text {
  color: #6b7280;
  font-size: 0.875rem;
}

.table-container {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table-header {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.table-header-cell {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-body {
  background-color: #ffffff;
}

.table-row {
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.table-row:hover {
  background-color: #f9fafb;
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  padding: 1rem;
  font-size: 0.875rem;
  color: #111827;
}

.table-cell-title {
  min-width: 200px;
}

.cell-title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cell-title {
  font-weight: 500;
  color: #111827;
}

.cell-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-nav {
  background-color: #dbeafe;
  color: #1e40af;
}

.badge-footer {
  background-color: #dcfce7;
  color: #166534;
}

.table-cell-slug {
  min-width: 150px;
}

.cell-slug {
  padding: 0.25rem 0.5rem;
  background-color: #f3f4f6;
  border-radius: 0.25rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  color: #6b7280;
}

.table-cell-status {
  min-width: 100px;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-draft {
  background-color: #fef3c7;
  color: #92400e;
}

.status-published {
  background-color: #d1fae5;
  color: #065f46;
}

.status-archived {
  background-color: #e5e7eb;
  color: #374151;
}

.table-cell-views {
  min-width: 80px;
  color: #6b7280;
}

.table-cell-date {
  min-width: 120px;
  color: #6b7280;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .table-container {
    overflow-x: scroll;
  }

  .table-header-cell,
  .table-cell {
    padding: 0.5rem;
    font-size: 0.8125rem;
  }

  .table-cell-title {
    min-width: 150px;
  }

  .table-cell-slug {
    min-width: 120px;
  }
}
</style>
