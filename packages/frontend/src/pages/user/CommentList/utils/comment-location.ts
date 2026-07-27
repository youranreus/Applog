import type { IAdminComment } from '@/types/comment'

/** Build the public post/page link without anchoring non-approved comments. */
export function getAdminCommentLocation(
  item: Pick<IAdminComment, 'id' | 'status' | 'post' | 'page'>,
): string | undefined {
  const path = item.post
    ? `/archives/${item.post.slug}.html`
    : item.page
      ? `/${item.page.slug}.html`
      : undefined
  if (!path) return undefined
  return item.status === 'approved' ? `${path}#comment-${item.id}` : path
}
