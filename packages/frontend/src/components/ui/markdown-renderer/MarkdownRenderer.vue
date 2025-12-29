<script setup lang="ts">
import { ref, watch } from 'vue';
import { processMarkdown } from '@/utils/markdown';
import type { HTMLAttributes } from 'vue';

interface Props {
  /**
   * Markdown 内容字符串
   */
  content: string;
  /**
   * 自定义 class 类名
   */
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();

/**
 * 渲染后的 HTML 内容
 */
const renderedHtml = ref<string>('');

/**
 * 更新渲染内容
 *
 * 逻辑说明：
 * 1. 处理 markdown 内容并渲染为 HTML
 * 2. 更新渲染后的 HTML 内容
 */
const updateContent = async () => {
  if (props.content) {
    renderedHtml.value = await processMarkdown(props.content);
  } else {
    renderedHtml.value = '';
  }
};

// 监听 content 变化，立即执行一次
watch(() => props.content, updateContent, { immediate: true });
</script>

<template>
  <div :class="props.class" v-html="renderedHtml" />
</template>

