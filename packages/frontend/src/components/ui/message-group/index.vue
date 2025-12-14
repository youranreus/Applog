<script setup lang="ts">
import MessageBubble from '@/components/ui/message-bubble/index.vue'
import type { IMessageGroupProps } from './types'

/**
 * 消息组组件 Props
 */
const props = defineProps<IMessageGroupProps>()
</script>

<template>
  <div class="message-group">
    <!-- 头像区域（可选） -->
    <div v-if="props.avatar" class="avatar-container">
      <img :src="props.avatar" alt="avatar" class="avatar-image" />
    </div>

    <!-- 消息列表区域 -->
    <div class="messages-container">
      <MessageBubble
        v-for="message in props.messages"
        :key="message.id"
        :content="message.content"
      />

      <!-- 状态文本（可选） -->
      <div v-if="props.status" class="status-text">
        {{ props.status }}
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.message-group {
  @apply flex gap-3 w-full;
}

.avatar-container {
  @apply flex-shrink-0;
  @apply sticky bottom-1 self-end;
}

.avatar-image {
  @apply w-12 h-12 rounded-full object-cover;
}

.messages-container {
  @apply flex-1 flex flex-col gap-2;
}

.status-text {
  @apply text-xs text-gray-500 mt-1;
}
</style>
