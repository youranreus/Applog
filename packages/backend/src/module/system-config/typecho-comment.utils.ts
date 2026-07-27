import type { CommentEntity } from '@/entities';

export function mapTypechoCommentStatus(
  status: string,
): CommentEntity['status'] | undefined {
  if (status === 'approved') return 'approved';
  if (status === 'waiting') return 'pending';
  if (status === 'spam') return 'rejected';
  return undefined;
}
