<script setup lang="ts">
import { computed, ref } from 'vue';
import ArticleRenderer from '@/components/ui/article-renderer/ArticleRenderer.vue';
import type { IMarkdownEditorProps } from './types';

/**
 * 编辑器 Tab 类型
 */
type EditorTab = 'edit' | 'preview';

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
 * 当前激活的 Tab，默认为编辑
 */
const activeTab = ref<EditorTab>('edit');

/**
 * Tab 配置列表
 */
const tabs = [
  { key: 'edit' as EditorTab, label: '编辑' },
  { key: 'preview' as EditorTab, label: '预览' },
];

/**
 * 切换编辑/预览 Tab
 * @param tab - 目标 Tab
 */
function switchTab(tab: EditorTab): void {
  activeTab.value = tab;
}

/**
 * 同步 textarea 输入到 v-model
 * @param event - input 事件
 */
function handleInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}

/**
 * 聚焦事件转发
 * @param event - focus 事件
 */
function handleFocus(event: FocusEvent): void {
  emit('focus', event);
}

/**
 * 失焦事件转发
 * @param event - blur 事件
 */
function handleBlur(event: FocusEvent): void {
  emit('blur', event);
}

/**
 * 是否显示校验提示信息
 * @returns 是否显示校验提示
 */
const showValidationMessage = computed(() => {
  return props.validationMessage && props.validationStatus !== 'normal';
});
</script>

<template>
  <div class="markdown-editor-wrapper">
    <div
      class="editor-container"
      :class="{
        'editor-container-error': validationStatus === 'error',
        'editor-container-success': validationStatus === 'success',
      }"
    >
      <!-- Tab 导航 -->
      <div class="editor-tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="editor-tab-button"
          :class="{ 'editor-tab-button-active': activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 编辑 Tab：纯文本 Markdown 源码 -->
      <div v-show="activeTab === 'edit'" class="editor-content-wrapper">
        <textarea
          class="editor-textarea"
          :value="modelValue"
          :placeholder="placeholder || '请输入内容...'"
          spellcheck="false"
          @input="handleInput"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>

      <!-- 预览 Tab：与前台详情页一致的渲染 -->
      <div
        v-if="activeTab === 'preview'"
        class="editor-content-wrapper preview-content-wrapper article-content"
      >
        <ArticleRenderer
          v-if="modelValue"
          :content="modelValue"
          class="markdown-content"
        />
        <p v-else class="preview-empty">暂无内容</p>
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

.editor-container {
  @apply w-full border rounded-md transition-colors duration-200 bg-white overflow-hidden border-gray-300;
}

.editor-container-error {
  @apply border-red-500;
}

.editor-container-success {
  @apply border-green-500;
}

.editor-tab-bar {
  @apply flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50;
}

.editor-tab-button {
  @apply px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 cursor-pointer;
  @apply border border-transparent;
  @apply hover:bg-gray-100 hover:text-gray-900;
}

.editor-tab-button-active {
  @apply bg-white text-gray-900 shadow-sm border-gray-200;
}

.editor-content-wrapper {
  @apply h-[480px] overflow-hidden;
}

.editor-textarea {
  @apply w-full h-full px-4 py-3 text-sm font-mono leading-relaxed;
  @apply resize-none outline-none bg-transparent text-gray-900 overflow-y-auto;
  @apply placeholder:text-gray-400;
  box-sizing: border-box;
}

.preview-content-wrapper {
  @apply h-full px-4 py-3 overflow-y-auto;
  /* 覆盖 article-content 的上下 margin，改为滚动区内的 padding */
  margin-top: 0;
  margin-bottom: 0;
}

.preview-empty {
  @apply text-sm text-gray-400 text-center py-8;
}

.validation-message {
  @apply mt-1 text-xs text-gray-500;
}

.validation-message-error {
  @apply text-red-600;
}

.validation-message-success {
  @apply text-green-600;
}
</style>
