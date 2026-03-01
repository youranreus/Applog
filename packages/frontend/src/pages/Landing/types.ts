/**
 * Landing 栅格项主题
 * - text: 纯文本卡片（浅灰背景）
 * - image: 带图片/截图的卡片
 * - accent: 强调色背景卡片
 */
export type LandingGridItemTheme = 'text' | 'image' | 'accent';

/**
 * Landing 栅格单项配置
 * 用于首页栅格布局的可配置项
 */
export interface ILandingGridItem {
  /** 唯一标识，用于 key */
  id: string;
  /** 卡片标题（如 Foresight、Playground） */
  title?: string;
  /** 副标题或描述文案 */
  subtitle?: string;
  /** 图片地址，可选 */
  image?: string;
  /** 视觉主题，决定背景与排版 */
  theme?: LandingGridItemTheme;
  /** 占用栅格列数，默认 1 */
  colSpan?: 1 | 2 | 3;
  /** 占用栅格行数，默认 1 */
  rowSpan?: 1 | 2;
  /** 点击跳转链接，可选 */
  href?: string;
  /** 图标名称（如 ion-icon name），可选 */
  icon?: string;
}

/** Landing 组件 props（当前无外部传入，预留扩展） */
export interface IProps {}

/** Landing 组件 emits（当前无事件，预留扩展） */
export interface IEmits {}
