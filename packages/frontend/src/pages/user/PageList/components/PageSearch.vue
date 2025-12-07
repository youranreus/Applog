<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/constants/permission';
import Input from '@/components/ui/input/index.vue';

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
  <div class="page-search">
    <div class="search-container">
      <!-- 搜索框 -->
      <Input
        v-model="searchKeyword"
        type="text"
        class="search-input"
        placeholder="请输入页面标题或摘要..."
        :disabled="loading"
        @keydown="handleKeydown"
      />

      <button
          type="button"
          class="search-button"
          :disabled="loading"
          @click="handleSearch"
        >
          搜索
        </button>

      <!-- 新建按钮 -->
      <button
        type="button"
        class="create-button"
        :disabled="loading"
        @click="handleCreateNew"
      >
        新建页面
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-search {
  width: 100%;
  margin-bottom: 1.5rem;
}

.search-container {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-button {
  padding: 0.5rem 1rem;
  border: 1px solid #3b82f6;
  border-radius: 0.375rem;
  background-color: #3b82f6;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
}

.search-button:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.search-button:disabled {
  background-color: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.create-button {
  padding: 0.5rem 1rem;
  border: 1px solid #10b981;
  border-radius: 0.375rem;
  background-color: #10b981;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
}

.create-button:hover:not(:disabled) {
  background-color: #059669;
  border-color: #059669;
}

.create-button:disabled {
  background-color: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

/* 响应式布局 */
@media (max-width: 640px) {
  .search-container {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input-wrapper {
    min-width: 100%;
  }

  .create-button {
    width: 100%;
  }
}
</style>
