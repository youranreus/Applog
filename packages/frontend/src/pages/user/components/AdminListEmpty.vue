<script setup lang="ts">
import { Button } from '@/components/ui/button';

/**
 * 后台列表空状态 Props
 */
interface IAdminListEmptyProps {
  /** 主文案 */
  message: string;
  /** 是否为搜索无结果（显示清除而非新建） */
  isFiltered?: boolean;
  /** 主按钮文案 */
  actionLabel?: string;
}

/**
 * 后台列表空状态 Emits
 */
interface IAdminListEmptyEmits {
  /** 主操作（新建或清除） */
  (e: 'action'): void;
}

withDefaults(defineProps<IAdminListEmptyProps>(), {
  isFiltered: false,
  actionLabel: undefined,
});

const emit = defineEmits<IAdminListEmptyEmits>();

/**
 * 触发空态主操作
 */
function handleAction(): void {
  emit('action');
}
</script>

<template>
  <div class="admin-list-empty">
    <p class="admin-list-empty__text">{{ message }}</p>
    <Button
      v-if="actionLabel"
      type="button"
      :variant="isFiltered ? 'outline' : 'default'"
      @click="handleAction"
    >
      {{ actionLabel }}
    </Button>
  </div>
</template>

<style scoped>
.admin-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 20rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.admin-list-empty__text {
  margin: 0;
  max-width: 28rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--color-ash, #707070);
  text-wrap: pretty;
}
</style>
