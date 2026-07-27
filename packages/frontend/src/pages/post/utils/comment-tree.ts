import type { IPublicComment } from '@/types/comment'

const byCreatedAtAscending = (left: IPublicComment, right: IPublicComment) =>
  new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || left.id - right.id

const byCreatedAtDescending = (left: IPublicComment, right: IPublicComment) =>
  -byCreatedAtAscending(left, right)

function cloneTree(comment: IPublicComment, nodes: Map<number, IPublicComment>): IPublicComment {
  const clone: IPublicComment = { ...comment, replies: [] }
  nodes.set(clone.id, clone)
  clone.replies = (comment.replies ?? []).map((reply) => cloneTree(reply, nodes))
  return clone
}

/** Merge only capability-validated pending comments into the loaded public tree. */
export function mergeOwnedPendingComments(
  approvedRoots: IPublicComment[],
  pendingComments: IPublicComment[],
  includePendingRoots: boolean,
): IPublicComment[] {
  const nodes = new Map<number, IPublicComment>()
  const roots = approvedRoots.map((comment) => cloneTree(comment, nodes))
  const pendingById = new Map<number, IPublicComment>()
  for (const comment of pendingComments) {
    if (!nodes.has(comment.id)) pendingById.set(comment.id, comment)
  }
  const remaining = [...pendingById.values()].map((comment) => ({ ...comment, replies: [] }))

  let progressed = true
  while (remaining.length && progressed) {
    progressed = false
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const comment = remaining[index]!
      const parent = comment.parentId ? nodes.get(comment.parentId) : undefined
      if (comment.parentId && !parent) continue
      if (!comment.parentId && !includePendingRoots) {
        remaining.splice(index, 1)
        continue
      }
      nodes.set(comment.id, comment)
      if (parent) {
        ;(parent.replies ??= []).push(comment)
      } else {
        roots.push(comment)
      }
      remaining.splice(index, 1)
      progressed = true
    }
  }

  for (const node of nodes.values()) node.replies?.sort(byCreatedAtAscending)
  return roots.sort(byCreatedAtDescending)
}

export function parseCommentHash(hash: string): number | undefined {
  const match = /^#comment-([1-9]\d*)$/.exec(hash)
  if (!match) return undefined
  const id = Number(match[1])
  return Number.isSafeInteger(id) ? id : undefined
}
