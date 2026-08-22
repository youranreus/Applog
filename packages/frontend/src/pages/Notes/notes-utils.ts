import type { IFlomoPublicMemo } from '@applog/common'

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
