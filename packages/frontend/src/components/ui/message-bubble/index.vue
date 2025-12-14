<script setup lang="ts">
import MarkdownRenderer from '@/components/ui/markdown-renderer/MarkdownRenderer.vue'

interface Props {
  /**
   * 消息内容（Markdown 格式）
   */
  content: string
}

defineProps<Props>()
</script>

<template>
  <div class="message-bubble">
    <MarkdownRenderer :content="content" class="message-content" />
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.message-bubble {
  @apply bg-[#F0F1F6] rounded-2xl px-4 py-3 w-fit;
}

.message-content {
  @apply text-sm leading-relaxed;
}

.message-content :deep(p) {
  @apply m-0;
}

.message-content :deep(p + p) {
  @apply mt-2;
}

.message-content :deep(a) {
  @apply underline text-blue-400 hover:text-blue-300;
}
</style>
