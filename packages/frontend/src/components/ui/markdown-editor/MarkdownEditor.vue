<script setup lang="ts">
import { computed, ref } from 'vue'
import ArticleRenderer from '@/components/ui/article-renderer/ArticleRenderer.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { IMarkdownEditorProps } from './types'

/**
 * 编辑器 Tab 类型
 */
type EditorTab = 'edit' | 'preview'

/**
 * 编辑区与预览区共用的外框样式（固定高度、边框、圆角、错误态）
 * 固定三边高度避免切换 Tab 或长内容时外框跳动
 */
const CONTENT_FRAME_CLASS =
  'block h-[550px] max-h-[550px] min-h-[550px] w-full rounded-[8px] border border-input bg-frost px-4 py-3 text-sm transition-colors aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20'

const props = withDefaults(defineProps<IMarkdownEditorProps>(), {
  modelValue: '',
  placeholder: '',
  ariaInvalid: false,
})

/**
 * MarkdownEditor 组件的事件定义
 */
interface IMarkdownEditorEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}

const emit = defineEmits<IMarkdownEditorEmits>()

/**
 * 当前激活的 Tab，默认为编辑
 */
const activeTab = ref<EditorTab>('edit')

/**
 * 是否处于错误态（兼容 boolean 与 aria 字符串）
 * @returns 是否为 invalid
 */
const isInvalid = computed(() => {
  return props.ariaInvalid === true || props.ariaInvalid === 'true'
})

/**
 * 同步内容到 v-model
 * @param value - Textarea 当前值
 */
function handleUpdate(value: string | number): void {
  emit('update:modelValue', String(value))
}

/**
 * 聚焦事件转发
 * @param event - focus 事件
 */
function handleFocus(event: FocusEvent): void {
  emit('focus', event)
}

/**
 * 失焦事件转发
 * @param event - blur 事件
 */
function handleBlur(event: FocusEvent): void {
  emit('blur', event)
}
</script>

<template>
  <div class="markdown-editor-wrapper w-full">
    <Tabs v-model="activeTab" class="w-full">
      <TabsList>
        <TabsTrigger value="edit">
          编辑
        </TabsTrigger>
        <TabsTrigger value="preview">
          预览
        </TabsTrigger>
      </TabsList>

      <!-- 编辑：shadcn Textarea，外框与预览同尺寸 -->
      <TabsContent value="edit" class="mt-0">
        <Textarea
          :model-value="modelValue"
          :placeholder="placeholder || '请输入内容...'"
          :aria-invalid="isInvalid"
          spellcheck="false"
          :class="cn(
            CONTENT_FRAME_CLASS,
            'field-sizing-fixed resize-none overflow-y-auto font-mono leading-relaxed focus-visible:ring-2',
          )"
          @update:model-value="handleUpdate"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </TabsContent>

      <!-- 预览：与 Textarea 同框，内容由 ArticleRenderer 渲染 -->
      <TabsContent value="preview" class="mt-0">
        <div
          class="preview-content-wrapper article-content overflow-y-auto"
          :class="CONTENT_FRAME_CLASS"
          :aria-invalid="isInvalid"
        >
          <ArticleRenderer
            v-if="modelValue"
            :content="modelValue"
            class="markdown-content"
          />
          <p v-else class="py-8 text-center text-sm text-muted-foreground">
            暂无内容
          </p>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style scoped>
/* 覆盖 article-content 的上下 margin，改为滚动区内的 padding */
.preview-content-wrapper.article-content {
  margin-top: 0;
  margin-bottom: 0;
}
</style>
