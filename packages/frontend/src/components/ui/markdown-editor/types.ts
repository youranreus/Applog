/**
 * MarkdownEditor 组件的 Props 接口
 */
export interface IMarkdownEditorProps {
  /**
   * v-model 绑定的值（Markdown 格式字符串）
   */
  modelValue?: string
  /**
   * 占位提示文本
   */
  placeholder?: string
  /**
   * 校验错误态，透传至 Textarea / 预览外框
   * 对应 DOM 属性 aria-invalid
   */
  ariaInvalid?: boolean | 'true' | 'false'
}
