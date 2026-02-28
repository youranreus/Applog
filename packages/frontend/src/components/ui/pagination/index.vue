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

/** 每个页码项的宽度（px），与 CSS 中的 --item-width 保持一致 */
const ITEM_WIDTH = 32;
/** 可见页码数量 */
const VISIBLE_COUNT = 5;

/**
 * 是否可以点击上一页
 */
const canGoPrev = computed<boolean>(() => props.currentPage > 1);

/**
 * 是否可以点击下一页
 */
const canGoNext = computed<boolean>(() => props.currentPage < props.totalPages);

/**
 * 所有页码数组（完整列表，不做截窗）
 */
const allPages = computed<number[]>(() => {
  if (props.totalPages <= 0) return [];
  return Array.from({ length: props.totalPages }, (_, i) => i + 1);
});

/**
 * 滑动轨道的 translateX 偏移量
 * 使当前页尽量处于可见区域中央
 */
const trackOffset = computed<number>(() => {
  const { currentPage, totalPages } = props;
  if (totalPages <= VISIBLE_COUNT) return 0;

  // 理想偏移：当前页居中
  const idealOffset = -(currentPage - 1) * ITEM_WIDTH + Math.floor(VISIBLE_COUNT / 2) * ITEM_WIDTH;
  const minOffset = -(totalPages - VISIBLE_COUNT) * ITEM_WIDTH;
  const maxOffset = 0;

  return Math.min(maxOffset, Math.max(minOffset, idealOffset));
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
 */
function handlePageClick(page: number): void {
  if (page !== props.currentPage && page >= 1 && page <= props.totalPages) {
    props.onChange(page);
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
        <span>←</span>
        <span class="hidden sm:inline"> 上一页</span>
      </button>
    </div>

    <!-- 中：页码列表（固定宽度，overflow hidden，内部轨道滑动） -->
    <div class="flex-1 flex justify-center">
      <div class="pages-viewport">
        <div
          class="pages-track"
          :style="{ transform: `translateX(${trackOffset}px)` }"
        >
          <button
            v-for="page in allPages"
            :key="page"
            :class="[
              'page-btn',
              page === currentPage ? 'page-active' : 'page-inactive',
            ]"
            @click="handlePageClick(page)"
          >
            {{ page }}
          </button>
        </div>
      </div>
    </div>

    <!-- 右：下一页 -->
    <div class="flex-1 flex justify-end">
      <button
        v-if="canGoNext"
        class="prev-next-btn"
        @click="handleNext"
      >
        <span class="hidden sm:inline">下一页 </span>
        <span>→</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination {
  user-select: none;
  --item-width: 32px;
  --visible-count: 5;
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

/* 页码视口：固定宽度，溢出隐藏 */
.pages-viewport {
  width: calc(var(--item-width) * var(--visible-count));
  overflow: hidden;
}

/* 页码轨道：flex 排列所有页码，平滑横向移动 */
.pages-track {
  display: flex;
  transition: transform 0.3s ease;
}

/* 单个页码按钮 */
.page-btn {
  width: var(--item-width);
  height: var(--item-width);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  transition: opacity 0.2s ease;
}

@media (min-width: 640px) {
  .page-btn {
    font-size: 1rem;
  }
}

/* 当前页：完全不透明 + 加粗 */
.page-active {
  opacity: 1;
  font-weight: 500;
}

/* 非当前页：低透明度 */
.page-inactive {
  opacity: 0.4;
}

.page-inactive:hover {
  opacity: 0.7;
}
</style>
