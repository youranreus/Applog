<script setup lang="ts">
import { watch, onBeforeUnmount, computed, onMounted } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Marked, marked } from 'marked';
import EditorToolbar from './EditorToolbar.vue';
import type { IMarkdownEditorProps } from './types';

/**
 * 自定义 marked 实例：禁用 GFM 裸 URL 自动转链接
 * 使纯文本如 https://www.baidu.com 保持原样，不被解析为 [url](url)
 * 使用类型断言以兼容 @tiptap/markdown 的 marked 类型（实际仅使用 parse/setOptions）
 */
const markedNoAutolink = new Marked({
  tokenizer: {
    url() {
      return undefined;
    },
  },
}) as unknown as typeof marked;

/**
 * MarkdownEditor 组件的 Props
 */
const props = withDefaults(defineProps<IMarkdownEditorProps>(), {
  modelValue: '',
  placeholder: '',
  validationStatus: 'normal',
  validationMessage: '',
});

/**
 * MarkdownEditor 组件的事件定义
 */
interface IMarkdownEditorEmits {
  (e: 'update:modelValue', value: string): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
}

const emit = defineEmits<IMarkdownEditorEmits>();

/**
 * 初始化 Tiptap 编辑器
 * 使用 StarterKit 提供基础编辑功能，Markdown 扩展支持 markdown 双向转换
 * 使用自定义 marked 实例禁用裸 URL 自动转链接，保留用户原始 markdown
 * 注意：初始化时 content 设为空，后续通过 setContent 方法以 markdown 格式设置内容
 */
const editor = useEditor({
  extensions: [StarterKit, Markdown.configure({ marked: markedNoAutolink })],
  content: '',
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] px-4 py-3',
      'data-placeholder': props.placeholder || '请输入内容...',
    },
  },
  onUpdate: ({ editor }) => {
    // 当编辑器内容更新时，获取 markdown 格式的内容并触发 update:modelValue 事件
    const markdown = editor.getMarkdown();
    emit('update:modelValue', markdown);
  },
  onFocus: ({ event }) => {
    emit('focus', event as FocusEvent);
  },
  onBlur: ({ event }) => {
    emit('blur', event as FocusEvent);
  },
});

/**
 * 组件挂载后，设置初始 markdown 内容
 * 确保 modelValue 作为 markdown 格式被正确解析
 */
onMounted(() => {
  if (editor.value && props.modelValue) {
    editor.value.commands.setContent(props.modelValue, { contentType: 'markdown' });
  }
});

/**
 * 监听外部 modelValue 变化，同步到编辑器
 * 避免循环更新：只有当外部值与编辑器当前值不同时才更新
 */
watch(
  () => props.modelValue,
  (newVal) => {
    if (editor.value) {
      const currentMarkdown = editor.value.getMarkdown();
      // 只有当新值与当前值不同时才更新，避免循环更新
      if (newVal !== currentMarkdown) {
        editor.value.commands.setContent(newVal || '', { contentType: 'markdown' });
      }
    }
  },
  { immediate: false }
);

/**
 * 监听 placeholder 变化，更新编辑器占位符
 */
watch(
  () => props.placeholder,
  (newPlaceholder) => {
    if (editor.value) {
      const currentAttributes = editor.value.options.editorProps?.attributes || {};
      editor.value.setOptions({
        editorProps: {
          ...editor.value.options.editorProps,
          attributes: {
            ...currentAttributes,
            'data-placeholder': newPlaceholder || '请输入内容...',
          },
        },
      });
    }
  }
);

/**
 * 组件卸载前销毁编辑器实例
 */
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});

/**
 * 是否显示校验提示信息
 */
const showValidationMessage = computed(() => {
  return props.validationMessage && props.validationStatus !== 'normal';
});
</script>

<template>
  <div class="markdown-editor-wrapper">
    <!-- 编辑器容器 -->
    <div
      class="editor-container"
      :class="{
        'editor-container-error': validationStatus === 'error',
        'editor-container-success': validationStatus === 'success',
      }"
    >
      <!-- 工具栏 -->
      <EditorToolbar :editor="editor" />

      <!-- 编辑器内容区域 -->
      <div class="editor-content-wrapper">
        <EditorContent :editor="editor" />
      </div>
    </div>

    <!-- 校验提示信息 -->
    <div
      v-if="showValidationMessage"
      class="validation-message"
      :class="{
        'validation-message-error': validationStatus === 'error',
        'validation-message-success': validationStatus === 'success',
      }"
    >
      {{ validationMessage }}
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.markdown-editor-wrapper {
  @apply w-full;
}

/* 编辑器容器基础样式 */
.editor-container {
  @apply w-full border rounded-md transition-colors duration-200 bg-white overflow-hidden border-gray-300;
}

/* 编辑器容器错误状态 */
.editor-container-error {
  @apply border-red-500;
}

/* 编辑器容器成功状态 */
.editor-container-success {
  @apply border-green-500;
}

.editor-content-wrapper {
  @apply min-h-[200px] max-h-[600px] overflow-y-auto;
}

/* 校验提示信息基础样式 */
.validation-message {
  @apply mt-1 text-xs text-gray-500;
}

/* 校验提示信息错误状态 */
.validation-message-error {
  @apply text-red-600;
}

/* 校验提示信息成功状态 */
.validation-message-success {
  @apply text-green-600;
}

/* Tiptap 编辑器样式 */
:deep(.ProseMirror) {
  @apply outline-none;
}

/* 占位符样式 */
:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  @apply text-gray-400;
  @apply float-left;
  @apply h-0;
  @apply pointer-events-none;
  content: attr(data-placeholder);
}

/* 聚焦时的占位符样式 */
:deep(.ProseMirror:focus p.is-editor-empty:first-child::before) {
  @apply text-gray-400;
}

/* 确保编辑器内容区域有合适的内边距 */
:deep(.ProseMirror) {
  @apply px-4 py-3;
}

/* 列表样式 */
:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  @apply pl-6;
  @apply my-2;
}

:deep(.ProseMirror ul) {
  @apply list-disc;
}

:deep(.ProseMirror ol) {
  @apply list-decimal;
}

:deep(.ProseMirror li) {
  @apply my-1;
}

/* 标题样式 */
:deep(.ProseMirror h1) {
  @apply text-2xl;
  @apply font-bold;
  @apply mt-4;
  @apply mb-2;
}

:deep(.ProseMirror h2) {
  @apply text-xl;
  @apply font-bold;
  @apply mt-3;
  @apply mb-2;
}

:deep(.ProseMirror h3) {
  @apply text-lg;
  @apply font-bold;
  @apply mt-2;
  @apply mb-1;
}

/* 段落样式 */
:deep(.ProseMirror p) {
  @apply my-2;
}

/* 引用块样式 */
:deep(.ProseMirror blockquote) {
  @apply border-l-4;
  @apply border-gray-300;
  @apply pl-4;
  @apply italic;
  @apply my-2;
  @apply text-gray-700;
}

/* 代码块样式 */
:deep(.ProseMirror pre) {
  @apply bg-gray-100;
  @apply rounded;
  @apply p-4;
  @apply overflow-x-auto;
  @apply my-2;
}

:deep(.ProseMirror code) {
  @apply bg-gray-100;
  @apply rounded;
  @apply px-1;
  @apply py-0.5;
  @apply text-sm;
  @apply font-mono;
}

:deep(.ProseMirror pre code) {
  @apply bg-transparent;
  @apply p-0;
}

/* 分隔线样式 */
:deep(.ProseMirror hr) {
  @apply border-t;
  @apply border-gray-300;
  @apply my-4;
}

/* 链接样式 */
:deep(.ProseMirror a) {
  @apply text-blue-600;
  @apply underline;
}

:deep(.ProseMirror a:hover) {
  @apply text-blue-800;
}
</style>

