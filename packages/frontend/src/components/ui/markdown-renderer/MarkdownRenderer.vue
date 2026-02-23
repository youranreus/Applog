<script setup lang="ts">
import { ref } from 'vue';
import { useMarkdownRenderer } from './hooks/useMarkdownRenderer';
import type { IProps } from './types';
import 'highlight.js/styles/github-dark.css';

defineOptions({
  name: 'MarkdownRenderer',
});

const props = defineProps<IProps>();

const containerRef = ref<HTMLElement | null>(null);
const { renderedHtml } = useMarkdownRenderer(props, containerRef);
</script>

<template>
  <div ref="containerRef" :class="props.class" v-html="renderedHtml" />
</template>

<style scoped lang="scss">
:deep(.lazy-image-wrapper) {
  position: relative;
  display: block;
}

:deep(.lazy-image-placeholder) {
  @apply text-gray-600 text-sm py-4 text-center;
}

:deep(.lazy-image) {
  opacity: 0;
  filter: blur(8px);
  transition: opacity 0.4s ease, filter 0.5s ease;

  &.loaded {
    opacity: 1;
    filter: blur(0);
  }
}
</style>
