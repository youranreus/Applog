<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { Search, XIcon } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * 后台列表搜索 Props
 */
interface IAdminListSearchProps {
  /** 当前搜索关键字（外部回填） */
  keyword?: string;
  /** 是否正在加载 */
  loading?: boolean;
  /** 输入框占位文案 */
  placeholder: string;
  /** 无障碍标签 */
  label?: string;
}

/**
 * 后台列表搜索 Emits
 */
interface IAdminListSearchEmits {
  /** 提交搜索（回车触发） */
  (e: 'search', keyword: string): void;
  /** 清除搜索 */
  (e: 'clear'): void;
}

const props = withDefaults(defineProps<IAdminListSearchProps>(), {
  keyword: '',
  loading: false,
  label: '搜索',
});

const emit = defineEmits<IAdminListSearchEmits>();

/**
 * 搜索输入框唯一 id（避免多实例 label 冲突）
 */
const searchInputId = useId();

/**
 * 本地输入值
 */
const searchKeyword = ref<string>(props.keyword || '');

/**
 * 是否显示清除按钮
 */
const showClear = computed(() => searchKeyword.value.length > 0);

/**
 * 同步外部 keyword
 */
watch(
  () => props.keyword,
  (value) => {
    searchKeyword.value = value || '';
  },
);

/**
 * 提交搜索
 */
function handleSearch(): void {
  emit('search', searchKeyword.value.trim());
}

/**
 * 清除输入；若已生效搜索则同步重置列表
 */
function handleClear(): void {
  searchKeyword.value = '';
  if (props.keyword) {
    emit('clear');
  }
}

/**
 * 回车触发搜索
 * @param event - 键盘事件
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSearch();
  }
}
</script>

<template>
  <div class="admin-list-search mb-6 w-full">
    <label
      class="sr-only"
      :for="searchInputId"
    >
      {{ label }}
    </label>
    <div class="admin-list-search__field relative w-full">
      <Search
        class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        :id="searchInputId"
        v-model="searchKeyword"
        type="search"
        class="admin-list-search__input w-full pr-8 pl-8"
        :placeholder="placeholder"
        :disabled="loading"
        autocomplete="off"
        enterkeyhint="search"
        @keydown="handleKeydown"
      />
      <Button
        v-if="showClear"
        type="button"
        variant="ghost"
        size="icon-xs"
        class="absolute top-1/2 right-1.5 size-6 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
        :disabled="loading"
        aria-label="清除搜索"
        @click="handleClear"
      >
        <XIcon
          class="size-3.5"
          :stroke-width="1.5"
        />
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* 隐藏系统自带的粗重清除按钮，改用自定义简约 X */
.admin-list-search__field :deep(input[type='search']::-webkit-search-cancel-button),
.admin-list-search__field :deep(input[type='search']::-webkit-search-decoration) {
  -webkit-appearance: none;
  appearance: none;
  display: none;
}
</style>
