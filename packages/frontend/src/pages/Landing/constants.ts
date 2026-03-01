import type { ILandingGridItem } from './types'

/** Landing 页主标题（标题区） */
export const LANDING_HERO_TITLE = '三叶の小窝'

/** Landing 页副标题（可选，标题区下方小字） */
export const LANDING_HERO_SUBTITLE = ''

/**
 * Landing 页栅格项默认配置
 * 可通过修改此数组调整首页栅格内容、顺序与占位
 */
export const LANDING_GRID_ITEMS: ILandingGridItem[] = [
  {
    id: 'card-1',
    title: 'Foresight',
    subtitle: 'AI vision technology to improve construction safety and security.',
    theme: 'text',
    colSpan: 2,
    rowSpan: 1,
    icon: 'lock-closed-outline',
  },
  {
    id: 'card-2',
    title: 'Dentist',
    subtitle: 'App interface design.',
    theme: 'image',
    colSpan: 1,
    rowSpan: 1,
    image: '', // 占位，可替换为实际图片 URL
  },
  {
    id: 'card-3',
    title: 'Augmented Reality',
    subtitle: 'Explore with AR.',
    theme: 'image',
    colSpan: 1,
    rowSpan: 1,
    image: '',
  },
  {
    id: 'card-4',
    title: 'Social',
    subtitle: 'Connect with others.',
    theme: 'image',
    colSpan: 2,
    rowSpan: 1,
    image: '',
  },
  {
    id: 'card-5',
    title: 'Playground',
    subtitle: 'Creative space.',
    theme: 'accent',
    colSpan: 3,
    rowSpan: 1,
  },
]
