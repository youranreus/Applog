<script setup lang="ts">
import { computed } from 'vue';
import type { IPaginationMeta } from '@/types/page';

/**
 * Props 定义
 */
interface Props {
  /** 分页元数据 */
  pagination?: IPaginationMeta;
  /** 是否正在加载 */
  loading?: boolean;
}

/**
 * Emits 定义
 */
interface Emits {
  /** 页码变化事件 */
  (e: 'page-change', page: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  pagination: undefined,
  loading: false,
});

const emit = defineEmits<Emits>();

/**
 * 是否有分页数据
 */
const hasPagination = computed(() => {
  return !!props.pagination;
});

/**
 * 当前页
 */
const currentPage = computed(() => {
  return props.pagination?.currentPage || 1;
});

/**
 * 总页数
 */
const totalPages = computed(() => {
  return props.pagination?.totalPages || 0;
});

/**
 * 总条数
 */
const totalItems = computed(() => {
  return props.pagination?.totalItems || 0;
});

/**
 * 每页条数
 */
const itemsPerPage = computed(() => {
  return props.pagination?.itemsPerPage || 10;
});

/**
 * 是否可以上一页
 */
const canPrev = computed(() => {
  return currentPage.value > 1 && !props.loading;
});

/**
 * 是否可以下一页
 */
const canNext = computed(() => {
  return currentPage.value < totalPages.value && !props.loading;
});

/**
 * 页码列表（显示当前页前后各2页）
 */
const pageNumbers = computed(() => {
  const pages: number[] = [];
  const current = currentPage.value;
  const total = totalPages.value;

  if (total <= 7) {
    // 总页数少于等于7页，显示所有页码
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // 总页数大于7页，显示当前页前后各2页
    if (current <= 3) {
      // 当前页在前3页
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push(-1); // 省略号占位
      pages.push(total);
    } else if (current >= total - 2) {
      // 当前页在后3页
      pages.push(1);
      pages.push(-1); // 省略号占位
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // 当前页在中间
      pages.push(1);
      pages.push(-1); // 省略号占位
      for (let i = current - 2; i <= current + 2; i++) {
        pages.push(i);
      }
      pages.push(-1); // 省略号占位
      pages.push(total);
    }
  }

  return pages;
});

/**
 * 跳转到指定页码
 * @param page - 目标页码
 */
function goToPage(page: number): void {
  if (page < 1 || page > totalPages.value || page === currentPage.value || props.loading) {
    return;
  }
  emit('page-change', page);
}

/**
 * 上一页
 */
function prevPage(): void {
  if (canPrev.value) {
    goToPage(currentPage.value - 1);
  }
}

/**
 * 下一页
 */
function nextPage(): void {
  if (canNext.value) {
    goToPage(currentPage.value + 1);
  }
}
</script>

<template>
  <div v-if="hasPagination" class="page-pagination">
    <!-- 分页信息 -->
    <div class="pagination-info">
      <span class="info-text">
        共 {{ totalItems }} 条，每页 {{ itemsPerPage }} 条
      </span>
    </div>

    <!-- 分页控件 -->
    <div class="pagination-controls">
      <!-- 上一页按钮 -->
      <button
        type="button"
        class="pagination-button pagination-button-prev"
        :disabled="!canPrev"
        @click="prevPage"
      >
        上一页
      </button>

      <!-- 页码按钮 -->
      <div class="pagination-pages">
        <button
          v-for="(page, index) in pageNumbers"
          :key="index"
          type="button"
          :class="[
            'pagination-button',
            'pagination-button-page',
            { 'pagination-button-active': page === currentPage },
            { 'pagination-button-ellipsis': page === -1 },
          ]"
          :disabled="page === -1 || props.loading"
          @click="goToPage(page)"
        >
          {{ page === -1 ? '...' : page }}
        </button>
      </div>

      <!-- 下一页按钮 -->
      <button
        type="button"
        class="pagination-button pagination-button-next"
        :disabled="!canNext"
        @click="nextPage"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  flex-wrap: wrap;
  gap: 1rem;
}

.pagination-info {
  display: flex;
  align-items: center;
}

.info-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-pages {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #ffffff;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, color 0.15s ease-in-out;
  min-width: 2.5rem;
  text-align: center;
}

.pagination-button:hover:not(:disabled) {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-button:disabled {
  background-color: #f9fafb;
  border-color: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.pagination-button-active {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.pagination-button-active:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.pagination-button-ellipsis {
  border: none;
  background-color: transparent;
  cursor: default;
  min-width: auto;
  padding: 0.5rem 0.25rem;
}

.pagination-button-ellipsis:hover {
  background-color: transparent;
}

.pagination-button-prev,
.pagination-button-next {
  min-width: auto;
  padding: 0.5rem 1rem;
}

/* 响应式布局 */
@media (max-width: 640px) {
  .page-pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-info {
    justify-content: center;
  }

  .pagination-controls {
    justify-content: center;
    flex-wrap: wrap;
  }

  .pagination-pages {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
