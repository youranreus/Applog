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
 * 是否可以点击上一页
 */
const canGoPrev = computed<boolean>(() => props.currentPage > 1);

/**
 * 是否可以点击下一页
 */
const canGoNext = computed<boolean>(() => props.currentPage < props.totalPages);

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
</script>

<template>
  <div v-if="totalPages > 0" class="pagination flex items-center w-full mb-8">
    <!-- 左：上一页 -->
    <div class="flex-1 flex justify-start">
      <button
        v-if="canGoPrev"
        class="prev-next-btn"
        @click="handlePrev"
      >
        <ion-icon name="chevron-back-outline"></ion-icon>
        <span class="inline"> 上一页</span>
      </button>
    </div>

    <!-- 右：下一页 -->
    <div class="flex-1 flex justify-end">
      <button
        v-if="canGoNext"
        class="prev-next-btn"
        @click="handleNext"
      >
        <span class="inline">下一页 </span>
        <ion-icon name="chevron-forward-outline"></ion-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination {
  user-select: none;
}

/* 上一页/下一页按钮 */
.prev-next-btn {
  color: rgb(0, 102, 204);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 2px;
  transition: opacity 0.2s ease;
}

.prev-next-btn:hover {
  opacity: 0.7;
}

@media (min-width: 640px) {
  .prev-next-btn {
    font-size: 1rem;
  }
}
</style>
