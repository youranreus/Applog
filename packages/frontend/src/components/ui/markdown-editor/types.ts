/**
 * 校验状态类型
 */
export type ValidationStatus = 'normal' | 'error' | 'success';

/**
 * MarkdownEditor 组件的 Props 接口
 */
export interface IMarkdownEditorProps {
  /**
   * v-model 绑定的值（Markdown 格式字符串）
   * 用于支持 v-model 双向绑定
   */
  modelValue?: string;
  /**
   * 占位提示文本
   */
  placeholder?: string;
  /**
   * 校验状态
   * - normal: 正常状态
   * - error: 错误状态（显示红色边框和错误提示）
   * - success: 成功状态
   */
  validationStatus?: ValidationStatus;
  /**
   * 校验提示信息
   * 当 validationStatus 为 'error' 时，此信息会显示在编辑器下方
   */
  validationMessage?: string;
}

