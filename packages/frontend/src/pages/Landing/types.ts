/**
 * Landing 栅格项主题
 * - text: 纯文本卡片（浅灰背景）
 * - image: 带图片/截图的卡片
 * - accent: 强调色背景卡片
 */
export type LandingGridItemTheme = 'text' | 'image' | 'accent'

/**
 * 背景图展示模式
 * - cover: 铺满居中
 * - top-left/top-right/bottom-left/bottom-right: 对齐到对应角
 */
export type LandingBgImageMode = 'cover' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * 卡片底部浮层徽章
 */
export interface ILandingBadge {
  /** 表情符号 */
  emoji?: string
  /** 文字标签 */
  label?: string
  /** 定位位置，默认 bottom-left */
  position?: 'bottom-left' | 'bottom-right'
  /** label 文字颜色（CSS color 值） */
  labelColor?: string
}

/**
 * Landing 栅格单项配置
 * 用于首页栅格布局的可配置项
 */
export interface ILandingGridItem {
  /** 唯一标识，用于 key */
  id: string
  /** 图片地址，可选 */
  image?: string
  /** 视觉主题，决定背景与排版 */
  theme?: LandingGridItemTheme
  /** 占用栅格列数，默认 1 */
  colSpan?: 1 | 2 | 3
  /** 占用栅格行数，默认 1 */
  rowSpan?: 1 | 2
  /** 点击跳转链接，可选 */
  href?: string
  /** 图标名称（如 ion-icon name），可选 */
  icon?: string
  /** icon 颜色（CSS color 值） */
  iconColor?: string
  /** description 颜色（CSS color 值），未设置时继承 iconColor */
  descriptionColor?: string
  /** 卡片背景色（inline style，优先级高于 theme 背景） */
  bgColor?: string
  /** 卡片背景图 URL */
  bgImage?: string
  /** 背景图展示模式，默认 cover */
  bgImageMode?: LandingBgImageMode
  /** 底部浮层徽章 */
  badge?: ILandingBadge
  /** icon 右侧的描述文字（与 icon 横排显示） */
  description?: string
}

/** Landing 组件 props（当前无外部传入，预留扩展） */
export interface IProps {}

/** Landing 组件 emits（当前无事件，预留扩展） */
export interface IEmits {}
