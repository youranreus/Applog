import type { ICommentTarget, IPendingCapability } from '@/types/comment'

type CommentTargetInput = ICommentTarget | number

const normalizeTarget = (target: CommentTargetInput): ICommentTarget =>
  typeof target === 'number' ? { type: 'post', id: target } : target

export const pendingCommentStorageKey = (targetInput: CommentTargetInput): string => {
  const target = normalizeTarget(targetInput)
  return target.type === 'post'
    ? `applog:pending-comments:${target.id}`
    : `applog:pending-comments:page:${target.id}`
}

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

export function readPendingCapabilities(target: CommentTargetInput): IPendingCapability[] {
  const key = pendingCommentStorageKey(target)
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    const items = normalizeCapabilities(value)
    if (items.length) sessionStorage.setItem(key, JSON.stringify(items))
    else sessionStorage.removeItem(key)
    return items
  } catch {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // Storage is unavailable; there is nothing else to clean up.
    }
    return []
  }
}

export function writePendingCapabilities(
  target: CommentTargetInput,
  items: IPendingCapability[],
): void {
  const key = pendingCommentStorageKey(target)
  try {
    const normalized = normalizeCapabilities(items)
    if (normalized.length) sessionStorage.setItem(key, JSON.stringify(normalized))
    else sessionStorage.removeItem(key)
  } catch {
    // Storage may be unavailable in privacy mode; the current-page state still works.
  }
}
