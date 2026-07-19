<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { IPageListItem } from '@/types/page';
import Loading from '@/components/ui/loading/index.vue';
import { ROUTE_NAMES } from '@/constants/permission';
import AdminListEmpty from '../../components/AdminListEmpty.vue';

/**
 * Props 定义
 */
interface IPageTableProps {
  /** 页面列表数据 */
  pages: IPageListItem[];
  /** 是否正在加载 */
  loading?: boolean;
  /** 当前是否有搜索关键字（区分空态） */
  hasKeyword?: boolean;
}

/**
 * Emits 定义
 */
interface IPageTableEmits {
  /** 空态：新建页面 */
  (e: 'create'): void;
  /** 空态：清除搜索 */
  (e: 'clear-search'): void;
}

const props = withDefaults(defineProps<IPageTableProps>(), {
  pages: () => [],
  loading: false,
  hasKeyword: false,
});

const emit = defineEmits<IPageTableEmits>();

const router = useRouter();

/**
 * 是否有数据
 */
const hasData = computed(() => props.pages.length > 0);

/**
 * 空态文案
 */
const emptyMessage = computed(() =>
  props.hasKeyword
    ? '没有找到相关页面。换个词试试，或清除搜索。'
    : '还没有独立页面。建一个关于页或友情链接页？',
);

/**
 * 空态按钮文案
 */
const emptyActionLabel = computed(() =>
  props.hasKeyword ? '清除搜索' : '新建页面',
);

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
 * 跳转到编辑页
 * @param slug - 页面 slug
 */
function goEdit(slug: string): void {
  router.push({
    name: ROUTE_NAMES.USER_PAGE_EDIT,
    params: { slug },
  });
}

/**
 * 行键盘激活
 * @param event - 键盘事件
 * @param slug - 页面 slug
 */
function handleRowKeydown(event: KeyboardEvent, slug: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    goEdit(slug);
  }
}

/**
 * 空态主操作
 */
function handleEmptyAction(): void {
  if (props.hasKeyword) {
    emit('clear-search');
    return;
  }
  emit('create');
}
</script>

<template>
  <div class="admin-content-table">
    <div
      v-if="loading"
      class="admin-content-table__loading"
      aria-busy="true"
      aria-live="polite"
    >
      <Loading :size="40" />
      <span class="sr-only">正在加载页面列表</span>
    </div>

    <div
      v-else-if="hasData"
      class="admin-content-table__scroll"
    >
      <table class="admin-content-table__table">
        <thead>
          <tr>
            <th scope="col">标题</th>
            <th
              scope="col"
              class="admin-content-table__col-slug"
            >
              Slug
            </th>
            <th
              scope="col"
              class="admin-content-table__col-placement"
            >
              作用于
            </th>
            <th
              scope="col"
              class="admin-content-table__col-status"
            >
              状态
            </th>
            <th
              scope="col"
              class="admin-content-table__col-meta"
            >
              更新
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="page in pages"
            :key="page.id"
            class="admin-content-table__row"
            tabindex="0"
            role="link"
            :aria-label="`编辑页面：${page.title}`"
            @click="goEdit(page.slug)"
            @keydown="handleRowKeydown($event, page.slug)"
          >
            <td class="admin-content-table__title">
              <span class="admin-content-table__title-text">{{ page.title }}</span>
            </td>
            <td class="admin-content-table__col-slug">
              <code class="admin-content-table__slug">{{ page.slug }}</code>
            </td>
            <td class="admin-content-table__col-placement">
              <span
                v-if="page.showInNav || page.showInFooter"
                class="admin-content-table__placements"
              >
                <span v-if="page.showInNav">导航</span>
                <span v-if="page.showInFooter">页脚</span>
              </span>
              <span
                v-else
                class="admin-content-table__placement-empty"
              >—</span>
            </td>
            <td class="admin-content-table__col-status">
              <span
                class="admin-content-table__status"
                :data-status="page.status"
              >
                {{ getStatusText(page.status) }}
              </span>
            </td>
            <td class="admin-content-table__col-meta admin-content-table__meta">
              {{ formatDate(page.updatedAt || page.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminListEmpty
      v-else
      :message="emptyMessage"
      :is-filtered="hasKeyword"
      :action-label="emptyActionLabel"
      @action="handleEmptyAction"
    />
  </div>
</template>

<style scoped>
.admin-content-table {
  width: 100%;
  border: 1px solid var(--color-pebble, #e2e2e5);
  border-radius: var(--radius-cards, 8px);
  background: #ffffff;
  overflow: hidden;
}

.admin-content-table__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20rem;
  padding: 3rem 1.5rem;
}

.admin-content-table__scroll {
  overflow-x: auto;
}

.admin-content-table__table {
  width: 100%;
  border-collapse: collapse;
}

.admin-content-table__table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-graphite, #474747);
  background: var(--color-frost, #f5f5f7);
  border-bottom: 1px solid var(--color-pebble, #e2e2e5);
}

.admin-content-table__table td {
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: var(--color-carbon, #1d1d1f);
  border-bottom: 1px solid var(--color-pebble, #e2e2e5);
  vertical-align: middle;
}

.admin-content-table__row {
  cursor: pointer;
  transition: background-color 0.15s ease-out;
}

.admin-content-table__row:hover {
  background: var(--color-frost, #f5f5f7);
}

.admin-content-table__row:focus {
  outline: none;
}

.admin-content-table__row:focus-visible {
  outline: 2px solid var(--color-apple-blue, #0071e3);
  outline-offset: -2px;
}

.admin-content-table__row:last-child td {
  border-bottom: none;
}

.admin-content-table__title-text {
  font-weight: 500;
}

.admin-content-table__col-slug,
.admin-content-table__col-status {
  width: 1%;
  min-width: 120px;
  white-space: nowrap;
  padding-inline: 0.75rem;
}

.admin-content-table__col-placement {
  width: 1%;
  min-width: 7rem;
  white-space: nowrap;
  padding-inline: 0.75rem;
}

.admin-content-table__slug {
  display: inline-block;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: var(--color-ash, #707070);
  vertical-align: middle;
}

.admin-content-table__placements {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-graphite, #474747);
}

.admin-content-table__placement-empty {
  color: var(--color-mist, #858585);
}

.admin-content-table__status {
  display: inline-block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-smoke, #333333);
}

.admin-content-table__status[data-status='draft']::before,
.admin-content-table__status[data-status='published']::before,
.admin-content-table__status[data-status='archived']::before {
  content: '';
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  margin-right: 0.4rem;
  border-radius: 999px;
  vertical-align: 0.05em;
  background: var(--color-mist, #858585);
}

.admin-content-table__status[data-status='published']::before {
  background: var(--color-apple-blue, #0071e3);
}

.admin-content-table__status[data-status='draft']::before {
  background: var(--color-ash, #707070);
}

.admin-content-table__col-meta {
  width: 1%;
  white-space: nowrap;
  padding-inline: 0.75rem;
}

.admin-content-table__meta {
  color: var(--color-ash, #707070);
}

@media (max-width: 768px) {
  .admin-content-table__table th,
  .admin-content-table__table td {
    padding: 0.625rem 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-content-table__row {
    transition: none;
  }
}
</style>
