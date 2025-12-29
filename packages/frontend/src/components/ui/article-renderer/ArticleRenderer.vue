<script setup lang="ts">
import { computed } from 'vue';
import { parseContent } from '@/utils/markdown';
import MarkdownRenderer from '@/components/ui/markdown-renderer/MarkdownRenderer.vue';
import type { HTMLAttributes } from 'vue';
import type { IContentFragment } from '@/utils/markdown/content-parser';

interface Props {
  /**
   * 文章原始内容（可能包含 Markdown 和 BBCode）
   */
  content: string;
  /**
   * 自定义 class 类名
   */
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();

/**
 * 解析后的内容片段数组
 *
 * 逻辑说明：
 * 1. 使用 parseContent 解析文章内容
 * 2. 将内容拆分为 markdown 片段和组件片段
 * 3. 每个片段包含类型、内容、组件及 props
 */
const fragments = computed<IContentFragment[]>(() => {
  if (!props.content) {
    return [];
  }
  return parseContent(props.content);
});
</script>

<template>
  <div :class="props.class" class="article-renderer">
    <template v-for="(fragment, index) in fragments" :key="index">
      <MarkdownRenderer
        v-if="fragment.type === 'markdown'"
        :content="fragment.content"
      />
      <component
        v-else-if="fragment.type === 'component' && fragment.component"
        :is="fragment.component"
        v-bind="fragment.props"
      />
    </template>
  </div>
</template>
