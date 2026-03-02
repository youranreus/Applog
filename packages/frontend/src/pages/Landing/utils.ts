import type { ILandingGridItem, LandingBgImageMode } from './types';

/**
 * 根据 colSpan 生成栅格列跨度 class
 * 移动端单列；平板 2 列；桌面 3 列
 * @param item - 栅格项配置
 * @returns Tailwind 栅格列跨度 class 字符串
 */
export function getColSpanClass(item: ILandingGridItem): string {
  const span = item.colSpan ?? 1;
  if (span === 1) return 'col-span-1';
  if (span === 2) return 'col-span-1 md:col-span-2';
  return 'col-span-1 md:col-span-2 lg:col-span-3';
}

/**
 * 根据 rowSpan 生成栅格行跨度 class
 * @param item - 栅格项配置
 * @returns Tailwind 栅格行跨度 class 字符串
 */
export function getRowSpanClass(item: ILandingGridItem): string {
  const span = item.rowSpan ?? 1;
  return span === 2 ? 'row-span-2' : 'row-span-1';
}

/**
 * 根据 theme 生成卡片容器 class
 * @param theme - 卡片视觉主题
 * @returns 卡片容器 class 字符串
 */
export function getCardThemeClass(
  theme: ILandingGridItem['theme'],
): string {
  switch (theme) {
    case 'text':
      return 'landing-card landing-card--text';
    case 'image':
      return 'landing-card landing-card--image';
    case 'accent':
      return 'landing-card landing-card--accent';
    default:
      return 'landing-card landing-card--text';
  }
}

export type HrefType = 'external' | 'internal' | 'none';

/**
 * href 类型判断
 * - http(s):// 开头 → external
 * - / 开头 → internal
 * - 其他/无 → none
 */
export function getHrefType(href?: string): HrefType {
  if (!href) return 'none';
  if (/^https?:\/\//.test(href)) return 'external';
  if (href.startsWith('/')) return 'internal';
  return 'none';
}

/**
 * 根据 bgImage + bgImageMode 生成内联 CSS 背景图属性
 * @param bgImage - 背景图 URL
 * @param bgImageMode - 展示模式
 * @returns 内联 style 对象（backgroundImage / backgroundSize / backgroundPosition）
 */
export function getBgImageStyle(
  bgImage?: string,
  bgImageMode?: LandingBgImageMode,
): Record<string, string> {
  if (!bgImage) return {};
  const mode = bgImageMode ?? 'cover';
  const style: Record<string, string> = {
    backgroundImage: `url(${bgImage})`,
    backgroundRepeat: 'no-repeat',
  };
  if (mode === 'cover') {
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  } else {
    style.backgroundSize = 'auto';
    style.backgroundPosition = mode.replace('-', ' ');
  }
  return style;
}

/**
 * 综合 bgColor 和 bgImage，生成卡片容器 style 对象
 * @param item - 栅格项配置
 * @returns 内联 style 对象
 */
export function getCardBgStyle(item: ILandingGridItem): Record<string, string> {
  const style: Record<string, string> = {};
  if (item.bgColor) {
    style.backgroundColor = item.bgColor;
  }
  return {
    ...style,
    ...getBgImageStyle(item.bgImage, item.bgImageMode),
  };
}
