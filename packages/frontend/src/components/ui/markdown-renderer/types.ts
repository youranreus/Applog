import type { HTMLAttributes } from 'vue';

/**
 * MarkdownRenderer 组件 Props
 */
export interface IProps {
  /**
   * Markdown 内容字符串
   */
  content: string;
  /**
   * 自定义 class 类名
   */
  class?: HTMLAttributes['class'];
}
