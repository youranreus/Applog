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
    id: '1',
    theme: 'text',
    description: '谁是季悠然？',
    colSpan: 2,
    rowSpan: 1,
    bgImage: 'https://cdn.exia.xyz/img/poster/self.png?x-oss-process=image/format,webp',
    badge: {
      emoji: '👦🏻',
      label: '02年生少年',
      position: 'bottom-left',
    },
  },
  {
    id: 'card-2',
    theme: 'image',
    colSpan: 1,
    rowSpan: 1,
    bgImage: 'https://cdn.exia.xyz/img/poster/map.png?x-oss-process=image/format,webp',
    badge: {
      emoji: '📍',
      label: '坐标 深圳',
      position: 'bottom-right',
    },
  },
  {
    id: 'card-3',
    theme: 'text',
    colSpan: 1,
    rowSpan: 1,
    icon: 'glasses-outline',
    description: 'Explore with AR.',
    bgColor: '#e8f4f8',
    badge: {
      emoji: '🕶️',
      label: 'AR',
      position: 'bottom-left',
    },
  },
  {
    id: 'card-4',
    theme: 'image',
    colSpan: 2,
    rowSpan: 1,
    bgImage: '',
    bgImageMode: 'top-left',
    icon: 'people-outline',
    description: 'Connect with others.',
    href: '/posts',
  },
  {
    id: 'card-5',
    theme: 'accent',
    colSpan: 3,
    rowSpan: 1,
    icon: 'rocket-outline',
    description: 'Creative space for experiments and play.',
    bgColor: '#f59e0b',
    href: 'https://github.com',
    badge: {
      emoji: '🚀',
      label: 'Playground',
      position: 'bottom-right',
    },
  },
]
