import type { IAdminComment } from '@/types/comment'

/** Build a public article link without anchoring non-approved comments. */
export function getAdminCommentLocation(
  item: Pick<IAdminComment, 'id' | 'status' | 'post'>,
): string | undefined {
  if (!item.post) return undefined
  const path = `/archives/${item.post.slug}.html`
  return item.status === 'approved' ? `${path}#comment-${item.id}` : path
}
