<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { IPostListItem } from '@/types/post';
import Loading from '@/components/ui/loading/index.vue';
import { ROUTE_NAMES } from '@/constants/permission';

/**
 * Props 定义
 */
interface Props {
  /** 文章列表数据 */
  posts: IPostListItem[];
  /** 是否正在加载 */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  posts: () => [],
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
  return props.posts.length > 0;
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
 * @param status - 文章状态
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
 * @param status - 文章状态
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
 * @param slug - 文章 slug
 */
function handleRowClick(slug: string): void {
  router.push({
    name: ROUTE_NAMES.USER_POST_EDIT,
    params: { slug },
  });
}
</script>

<template>
  <div class="post-table">
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
            <th class="table-header-cell">摘要</th>
            <th class="table-header-cell">状态</th>
            <th class="table-header-cell">作者</th>
            <th class="table-header-cell">浏览次数</th>
            <th class="table-header-cell">创建时间</th>
          </tr>
        </thead>
        <tbody class="table-body">
          <tr
            v-for="post in posts"
            :key="post.id"
            class="table-row"
            @click="handleRowClick(post.slug)"
          >
            <td class="table-cell table-cell-title">
              <div class="cell-title-wrapper">
                <span class="cell-title">{{ post.title }}</span>
                <span v-if="post.tags && post.tags.length > 0" class="cell-tags">
                  <span
                    v-for="tag in post.tags.slice(0, 3)"
                    :key="tag"
                    class="cell-tag"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="post.tags.length > 3" class="cell-tag-more">
                    +{{ post.tags.length - 3 }}
                  </span>
                </span>
              </div>
            </td>
            <td class="table-cell table-cell-summary">
              <span class="cell-summary">{{ post.summary || '-' }}</span>
            </td>
            <td class="table-cell table-cell-status">
              <span :class="['status-badge', getStatusClass(post.status)]">
                {{ getStatusText(post.status) }}
              </span>
            </td>
            <td class="table-cell table-cell-author">
              <div v-if="post.author" class="cell-author">
                <span class="author-name">{{ post.author.name }}</span>
              </div>
              <span v-else class="cell-author-empty">-</span>
            </td>
            <td class="table-cell table-cell-views">
              {{ post.viewCount }}
            </td>
            <td class="table-cell table-cell-date">
              {{ formatDate(post.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 空状态 -->
    <div v-else class="table-empty">
      <p class="empty-text">暂无文章数据</p>
    </div>
  </div>
</template>

<style scoped>
.post-table {
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
  min-height: 400px;
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
  flex-direction: column;
  gap: 0.5rem;
}

.cell-title {
  font-weight: 500;
  color: #111827;
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.cell-tag {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #e0e7ff;
  color: #4338ca;
}

.cell-tag-more {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #f3f4f6;
  color: #6b7280;
}

.table-cell-summary {
  min-width: 200px;
  max-width: 300px;
}

.cell-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #6b7280;
  line-height: 1.5;
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

.table-cell-author {
  min-width: 120px;
}

.cell-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.author-name {
  color: #111827;
  font-weight: 500;
}

.cell-author-empty {
  color: #9ca3af;
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

  .table-cell-summary {
    min-width: 150px;
    max-width: 200px;
  }
}
</style>
