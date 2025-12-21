<script setup lang="ts">
import { computed } from 'vue';

/**
 * 分页组件 Props
 */
interface IPaginationProps {
  /** 当前页码（从 1 开始） */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 页码变化回调函数 */
  onChange: (page: number) => void;
}

const props = defineProps<IPaginationProps>();

/**
 * 计算显示的页码范围
 * 最多显示 5 个页码，当前页居中显示
 * @returns 页码数组
 */
const visiblePages = computed<number[]>(() => {
  const { currentPage, totalPages } = props;
  
  if (totalPages <= 0) {
    return [];
  }
  
  if (totalPages <= 5) {
    // 总页数小于等于 5，显示所有页码
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  // 总页数大于 5，计算显示范围
  let start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  
  // 如果当前页接近末尾，调整起始位置
  if (end - start < 4) {
    start = Math.max(1, end - 4);
  }
  
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

/**
 * 是否可以点击上一页
 */
const canGoPrev = computed<boolean>(() => {
  return props.currentPage > 1;
});

/**
 * 是否可以点击下一页
 */
const canGoNext = computed<boolean>(() => {
  return props.currentPage < props.totalPages;
});

/**
 * 处理上一页点击
 */
function handlePrev(): void {
  if (canGoPrev.value) {
    props.onChange(props.currentPage - 1);
  }
}

/**
 * 处理下一页点击
 */
function handleNext(): void {
  if (canGoNext.value) {
    props.onChange(props.currentPage + 1);
  }
}

/**
 * 处理页码点击
 * @param page - 目标页码
 */
function handlePageClick(page: number): void {
  if (page !== props.currentPage && page >= 1 && page <= props.totalPages) {
    props.onChange(page);
  }
}
</script>

<template>
  <div v-if="totalPages > 0" class="pagination flex items-center justify-center gap-2">
    <!-- 上一页按钮 -->
    <button
      :disabled="!canGoPrev"
      :class="[
        'px-3 py-1 rounded transition-colors',
        canGoPrev
          ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
          : 'text-gray-400 cursor-not-allowed',
      ]"
      @click="handlePrev"
    >
      ←
    </button>

    <!-- 页码按钮 -->
    <button
      v-for="page in visiblePages"
      :key="page"
      :class="[
        'px-3 py-1 rounded transition-colors min-w-[2.5rem]',
        page === currentPage
          ? 'bg-gray-900 text-white font-medium'
          : 'text-gray-700 hover:bg-gray-100',
      ]"
      @click="handlePageClick(page)"
    >
      {{ page }}
    </button>

    <!-- 下一页按钮 -->
    <button
      :disabled="!canGoNext"
      :class="[
        'px-3 py-1 rounded transition-colors',
        canGoNext
          ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
          : 'text-gray-400 cursor-not-allowed',
      ]"
      @click="handleNext"
    >
      →
    </button>
  </div>
</template>

<style scoped>
.pagination {
  user-select: none;
}

.pagination button:disabled {
  opacity: 0.5;
}
</style>

