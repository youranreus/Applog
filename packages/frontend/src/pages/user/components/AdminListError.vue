<script setup lang="ts">
import { Button } from '@/components/ui/button';

/**
 * 后台列表错误态 Props
 */
interface IAdminListErrorProps {
  /** 错误说明（已人话化） */
  message: string;
  /** 是否正在重试 */
  loading?: boolean;
}

/**
 * 后台列表错误态 Emits
 */
interface IAdminListErrorEmits {
  /** 点击重试 */
  (e: 'retry'): void;
}

withDefaults(defineProps<IAdminListErrorProps>(), {
  loading: false,
});

const emit = defineEmits<IAdminListErrorEmits>();

/**
 * 触发重试
 */
function handleRetry(): void {
  emit('retry');
}
</script>

<template>
  <div
    class="admin-list-error"
    role="alert"
  >
    <p class="admin-list-error__text">
      {{ message }}
    </p>
    <Button
      type="button"
      variant="outline"
      :disabled="loading"
      @click="handleRetry"
    >
      重试
    </Button>
  </div>
</template>

<style scoped>
.admin-list-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid color-mix(in oklab, var(--destructive) 35%, transparent);
  border-radius: var(--radius-cards, 8px);
  background: color-mix(in oklab, var(--destructive) 6%, white);
}

.admin-list-error__text {
  margin: 0;
  flex: 1 1 12rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-carbon, #1d1d1f);
}
</style>
