import type { ILandingGridItem } from './types';

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
