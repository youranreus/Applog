<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/constants/permission';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Props 定义
 */
interface Props {
  /** 搜索关键字 */
  keyword?: string;
  /** 是否正在加载 */
  loading?: boolean;
}

/**
 * Emits 定义
 */
interface Emits {
  /** 搜索事件 */
  (e: 'search', keyword: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  keyword: '',
  loading: false,
});

const emit = defineEmits<Emits>();

/**
 * 路由实例
 */
const router = useRouter();

/**
 * 搜索关键字（本地状态）
 */
const searchKeyword = ref<string>(props.keyword || '');

/**
 * 执行搜索
 */
function handleSearch(): void {
  emit('search', searchKeyword.value.trim());
}

/**
 * 处理回车键搜索
 * @param event - 键盘事件
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    handleSearch();
  }
}

/**
 * 跳转到新建页面
 */
function handleCreateNew(): void {
  router.push({
    name: ROUTE_NAMES.USER_PAGE_CREATE,
  });
}
</script>

<template>
  <div class="mb-6 w-full">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Input
        v-model="searchKeyword"
        type="text"
        class="flex-1"
        placeholder="请输入页面标题或摘要..."
        :disabled="loading"
        @keydown="handleKeydown"
      />

      <Button
        type="button"
        :disabled="loading"
        @click="handleSearch"
      >
        搜索
      </Button>

      <Button
        type="button"
        variant="secondary"
        :disabled="loading"
        @click="handleCreateNew"
      >
        新建页面
      </Button>
    </div>
  </div>
</template>
