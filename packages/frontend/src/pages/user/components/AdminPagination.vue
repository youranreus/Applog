<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IPaginationMeta } from '@/types/post';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

/**
 * 后台列表分页 Props
 */
interface IAdminPaginationProps {
  /** 分页元数据 */
  pagination?: IPaginationMeta;
  /** 是否正在加载 */
  loading?: boolean;
}

/**
 * 后台列表分页 Emits
 */
interface IAdminPaginationEmits {
  /** 页码变化事件 */
  (e: 'page-change', page: number): void;
}

const props = withDefaults(defineProps<IAdminPaginationProps>(), {
  pagination: undefined,
  loading: false,
});

const emit = defineEmits<IAdminPaginationEmits>();

/**
 * 是否有分页数据
 */
const hasPagination = computed<boolean>(() => !!props.pagination);

/**
 * 当前页（与 shadcn Pagination v-model:page 同步）
 */
const currentPage = ref<number>(props.pagination?.currentPage || 1);

/**
 * 总条数
 */
const totalItems = computed<number>(() => props.pagination?.totalItems || 0);

/**
 * 每页条数
 */
const itemsPerPage = computed<number>(() => props.pagination?.itemsPerPage || 10);

/**
 * 监听外部 pagination 变化，同步当前页
 */
watch(
  () => props.pagination?.currentPage,
  (page) => {
    if (page !== undefined && page !== currentPage.value) {
      currentPage.value = page;
    }
  },
);

/**
 * 处理页码变化
 * @param page - 目标页码
 *
 * 逻辑说明：
 * 1. 加载中或页码未变时回滚到外部页码，不重复请求
 * 2. 否则乐观更新本地页码并抛出 page-change
 */
function handlePageUpdate(page: number): void {
  if (props.loading || page === props.pagination?.currentPage) {
    currentPage.value = props.pagination?.currentPage || 1;
    return;
  }
  currentPage.value = page;
  emit('page-change', page);
}
</script>

<template>
  <div
    v-if="hasPagination"
    class="flex flex-wrap items-center justify-between gap-4 py-4"
  >
    <p class="text-sm text-muted-foreground">
      共 {{ totalItems }} 条，每页 {{ itemsPerPage }} 条
    </p>

    <Pagination
      v-slot="{ page }"
      :page="currentPage"
      :items-per-page="itemsPerPage"
      :total="totalItems"
      :sibling-count="1"
      show-edges
      :disabled="loading"
      class="mx-0 w-auto justify-end"
      @update:page="handlePageUpdate"
    >
      <PaginationContent v-slot="{ items }" class="flex-wrap justify-end">
        <PaginationPrevious>
          <span>上一页</span>
        </PaginationPrevious>

        <template v-for="(item, index) in items" :key="index">
          <PaginationItem
            v-if="item.type === 'page'"
            :value="item.value"
            :is-active="item.value === page"
          >
            {{ item.value }}
          </PaginationItem>
          <PaginationEllipsis
            v-else
            :index="index"
          />
        </template>

        <PaginationNext>
          <span>下一页</span>
        </PaginationNext>
      </PaginationContent>
    </Pagination>
  </div>
</template>
