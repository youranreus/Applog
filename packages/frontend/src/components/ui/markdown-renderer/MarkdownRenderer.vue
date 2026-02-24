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
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
}

:global(.lazy-image-placeholder) {
  color: black;
  opacity: 0.5;
  font-size: 24px;
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
