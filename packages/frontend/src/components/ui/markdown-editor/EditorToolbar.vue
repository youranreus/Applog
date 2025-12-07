<script setup lang="ts">
import { computed } from 'vue';
import type { useEditor } from '@tiptap/vue-3';

/**
 * 从 useEditor 的返回类型中提取 Editor 类型
 */
type EditorInstance = NonNullable<ReturnType<typeof useEditor>['value']>;

/**
 * EditorToolbar 组件的 Props 接口
 */
interface IEditorToolbarProps {
  /**
   * Tiptap 编辑器实例
   */
  editor?: EditorInstance | null;
}

const props = defineProps<IEditorToolbarProps>();

/**
 * 检查编辑器是否可用
 */
const isEditorReady = computed(() => {
  return props.editor !== null;
});

/**
 * 执行编辑器命令（带安全检查）
 * @param command - 命令函数
 */
const executeCommand = (command: () => void): void => {
  if (isEditorReady.value && props.editor) {
    command();
  }
};
</script>

<template>
  <div
    v-if="isEditorReady"
    class="editor-toolbar flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 bg-gray-50"
  >
    <!-- 文本格式组 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('bold') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleBold().run())"
        title="加粗 (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('italic') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleItalic().run())"
        title="斜体 (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('strike') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleStrike().run())"
        title="删除线"
      >
        <s>S</s>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('code') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleCode().run())"
        title="行内代码"
      >
        <ion-icon name="code-slash-outline"></ion-icon>
      </button>
    </div>

    <!-- 分隔线 -->
    <div class="w-px h-6 bg-gray-300" />

    <!-- 标题组 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('heading', { level: 1 }) }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())"
        title="标题 1"
      >
        H1
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('heading', { level: 2 }) }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())"
        title="标题 2"
      >
        H2
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('heading', { level: 3 }) }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())"
        title="标题 3"
      >
        H3
      </button>
    </div>

    <!-- 分隔线 -->
    <div class="w-px h-6 bg-gray-300" />

    <!-- 列表组 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('bulletList') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleBulletList().run())"
        title="无序列表"
      >
      <ion-icon name="list-outline"></ion-icon>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('orderedList') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleOrderedList().run())"
        title="有序列表"
      >
        1.
      </button>
    </div>

    <!-- 分隔线 -->
    <div class="w-px h-6 bg-gray-300" />

    <!-- 其他格式组 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('blockquote') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleBlockquote().run())"
        title="引用块"
      >
        <ion-icon name="chatbubble-outline"></ion-icon>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :class="{ 'toolbar-button-active': editor?.isActive('codeBlock') }"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().toggleCodeBlock().run())"
        title="代码块"
      >
        <ion-icon name="code-slash-outline"></ion-icon>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :disabled="!isEditorReady"
        @click="executeCommand(() => editor?.chain().focus().setHorizontalRule().run())"
        title="分隔线"
      >
        ─
      </button>
    </div>

    <!-- 分隔线 -->
    <div class="w-px h-6 bg-gray-300" />

    <!-- 历史操作组 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="toolbar-button"
        :disabled="!isEditorReady || !editor?.can().undo()"
        @click="executeCommand(() => editor?.chain().focus().undo().run())"
        title="撤销 (Ctrl+Z)"
      >
        <ion-icon name="return-up-back-outline"></ion-icon>
      </button>
      <button
        type="button"
        class="toolbar-button"
        :disabled="!isEditorReady || !editor?.can().redo()"
        @click="executeCommand(() => editor?.chain().focus().redo().run())"
        title="重做 (Ctrl+Y)"
      >
        <ion-icon name="return-up-forward-outline"></ion-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.editor-toolbar {
  @apply rounded-t-md;
}

/* 工具栏按钮基础样式 */
.toolbar-button {
  @apply flex items-center justify-center h-[34px] px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 border border-gray-300 bg-white cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed;
}

/* 工具栏按钮激活状态样式 */
.toolbar-button-active {
  @apply bg-gray-100 border-gray-400 text-gray-900;
}

/* 确保按钮文本样式正确 */
.toolbar-button strong {
  @apply font-bold;
}

.toolbar-button em {
  @apply italic;
}

.toolbar-button s {
  @apply line-through;
}
</style>

