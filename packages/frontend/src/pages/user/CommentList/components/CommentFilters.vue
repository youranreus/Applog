<script setup lang="ts">
import type { CommentStatus } from '@/types/comment'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
defineProps<{ status?: CommentStatus; loading?: boolean }>()
const emit = defineEmits<{ change: [status?: CommentStatus] }>()
function handleChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  emit('change', value ? (value as CommentStatus) : undefined)
}
</script>
<template>
  <div class="filters">
    <label for="comment-status">状态</label
    ><NativeSelect
      id="comment-status"
      :model-value="status || ''"
      :disabled="loading"
      @change="handleChange"
      ><NativeSelectOption value="">全部</NativeSelectOption
      ><NativeSelectOption value="pending">待审核</NativeSelectOption
      ><NativeSelectOption value="approved">已通过</NativeSelectOption
      ><NativeSelectOption value="rejected">已拒绝</NativeSelectOption></NativeSelect
    >
  </div>
</template>
<style scoped>
.filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.filters label {
  font-size: 0.9rem;
  color: var(--muted-foreground);
}
</style>
