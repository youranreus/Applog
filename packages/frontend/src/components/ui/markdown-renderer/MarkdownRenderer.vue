<script setup lang="ts">
import { ref, watch } from 'vue';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
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
 * 处理 Markdown 并转换为 HTML
 * @param markdown - Markdown 字符串
 * @returns 渲染后的 HTML 字符串
 */
const processMarkdown = async (markdown: string): Promise<string> => {
  try {
    const processor = unified()
      // 解析 Markdown
      .use(remarkParse)
      // GitHub Flavored Markdown 支持（表格、任务列表、删除线等）
      .use(remarkGfm)
      // 支持换行（两个空格或反斜杠换行）
      .use(remarkBreaks)
      // 将 Markdown AST 转换为 HTML AST
      .use(remarkRehype)
      // 为标题添加 id 属性（用于锚点链接）
      .use(rehypeSlug)
      // 为标题自动添加链接
      .use(rehypeAutolinkHeadings, {
        behavior: 'wrap',
        properties: {
          className: ['heading-anchor'],
        },
      })
      // 将 HTML AST 转换为 HTML 字符串
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    return String(result);
  } catch (error) {
    console.error('Markdown 渲染失败:', error);
    return `<p>内容渲染失败: ${error instanceof Error ? error.message : '未知错误'}</p>`;
  }
};

/**
 * 更新渲染内容
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

