import type { IPendingCapability } from '@/types/comment'

const keyForPost = (postId: number) => `applog:pending-comments:${postId}`

function normalizeCapabilities(value: unknown): IPendingCapability[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<number, IPendingCapability>()
  for (const item of value) {
    if (
      typeof item === 'object' &&
      item !== null &&
      Number.isInteger((item as IPendingCapability).commentId) &&
      (item as IPendingCapability).commentId > 0 &&
      typeof (item as IPendingCapability).token === 'string' &&
      (item as IPendingCapability).token.length >= 32 &&
      (item as IPendingCapability).token.length <= 256
    ) {
      byId.set((item as IPendingCapability).commentId, item as IPendingCapability)
    }
  }
  return [...byId.values()].slice(-20)
}

export function readPendingCapabilities(postId: number): IPendingCapability[] {
  try {
    const raw = sessionStorage.getItem(keyForPost(postId))
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    const items = normalizeCapabilities(value)
    if (items.length) sessionStorage.setItem(keyForPost(postId), JSON.stringify(items))
    else sessionStorage.removeItem(keyForPost(postId))
    return items
  } catch {
    try {
      sessionStorage.removeItem(keyForPost(postId))
    } catch {
      // Storage is unavailable; there is nothing else to clean up.
    }
    return []
  }
}

export function writePendingCapabilities(postId: number, items: IPendingCapability[]): void {
  try {
    const normalized = normalizeCapabilities(items)
    if (normalized.length)
      sessionStorage.setItem(keyForPost(postId), JSON.stringify(normalized))
    else sessionStorage.removeItem(keyForPost(postId))
  } catch {
    // Storage may be unavailable in privacy mode; the current-page state still works.
  }
}
