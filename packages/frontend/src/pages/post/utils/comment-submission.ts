import type { ICreateCommentResponse, IPendingCapability } from '@/types/comment'

export type CommentSubmissionOutcome =
  | { kind: 'approved'; resetToFirstPage: boolean }
  | { kind: 'pending'; capability?: IPendingCapability }

/** Convert the create response into the two visibility flows used by the page composable. */
export function getCommentSubmissionOutcome(
  result: ICreateCommentResponse,
  submittedAsRoot: boolean,
): CommentSubmissionOutcome {
  if (result.comment.status === 'approved') {
    return { kind: 'approved', resetToFirstPage: submittedAsRoot }
  }
  return {
    kind: 'pending',
    capability: result.withdrawToken
      ? { commentId: result.comment.id, token: result.withdrawToken }
      : undefined,
  }
}
