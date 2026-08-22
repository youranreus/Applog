import type { IFlomoPublicMemo } from '@applog/common'

/** Two-column masonry starts at this viewport width. */
export const NOTES_WIDE_MEDIA_QUERY = '(min-width: 701px)'

/** Teleport target for the expanding source card inside the reading dialog. */
export const FLOMO_CARD_SLOT_ID = 'flomo-note-card-slot'

/**
 * Split notes into columns in row-major order so visual reading is 1,2 then 3,4.
 * @param items - Notes in newest-first list order
 * @param columnCount - Number of waterfall columns
 * @returns Column arrays; index 0 is the left column
 */
export function splitNotesIntoColumns<T>(items: readonly T[], columnCount: number): T[][] {
  const count = Math.max(1, Math.floor(columnCount))
  const columns: T[][] = Array.from({ length: count }, () => [])
  items.forEach((item, index) => {
    columns[index % count]?.push(item)
  })
  return columns
}

/** Append a page while preserving existing order and suppressing duplicate public ids. */
export function appendUniqueFlomoNotes(
  current: readonly IFlomoPublicMemo[],
  incoming: readonly IFlomoPublicMemo[],
): IFlomoPublicMemo[] {
  const ids = new Set(current.map((item) => item.id))
  return [...current, ...incoming.filter((item) => !ids.has(item.id) && ids.add(item.id))]
}

/** Reader-facing local date without leaking upstream metadata. */
export function formatFlomoNoteDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/** FLIP geometry is progressive enhancement and disabled for reduced motion. */
export function shouldMorphFlomoDialog(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.animate === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface IScrollMetrics {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

/**
 * Whether a box's content is taller than its visible area.
 * @param element - A real element or scroll-metric snapshot
 * @returns True when the content overflows by more than 1px
 */
export function isOverflowing(element: Pick<IScrollMetrics, 'scrollHeight' | 'clientHeight'>): boolean {
  return element.scrollHeight > element.clientHeight + 1
}

/**
 * Whether a scroll box is at (or within 1px of) its trailing edge.
 * @param element - A real element or scroll-metric snapshot
 * @returns True when no more content remains below
 */
export function isScrolledToBottom(element: IScrollMetrics): boolean {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - 1
}
