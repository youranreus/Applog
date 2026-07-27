import { alovaInstance } from '@/utils/alova'
import type {
  CommentPagination,
  CommentStatus,
  IAdminComment,
  ICommentLocation,
  ICreateComment,
  ICreateCommentResponse,
  ICommentTarget,
  IDeleteImpact,
  IPendingCapability,
  IPublicComment,
} from '@/types/comment'

function targetParams(target: ICommentTarget): { postId: number } | { pageId: number } {
  return target.type === 'post' ? { postId: target.id } : { pageId: target.id }
}

export function getPublicComments(target: ICommentTarget, page = 1, limit = 10) {
  return alovaInstance.Get<CommentPagination<IPublicComment>>('/comment', {
    params: { ...targetParams(target), page, limit },
  })
}

export function createComment(payload: ICreateComment) {
  return alovaInstance.Post<ICreateCommentResponse>('/comment', payload)
}

export function resolvePendingComments(capabilities: IPendingCapability[]) {
  return alovaInstance.Post<IPublicComment[]>('/comment/pending/resolve', { capabilities })
}

export function withdrawComment(commentId: number, token: string) {
  return alovaInstance.Post<{ deleted: boolean }>(`/comment/${commentId}/withdraw`, { token })
}

export function getCommentLocation(commentId: number, limit = 10) {
  return alovaInstance.Get<ICommentLocation>(`/comment/${commentId}/location`, {
    params: { limit },
  })
}

export function getAdminComments(query: {
  page?: number
  limit?: number
  status?: CommentStatus
  postId?: number
  pageId?: number
}) {
  return alovaInstance.Get<CommentPagination<IAdminComment>>('/comment/admin', { params: query })
}

export function moderateComment(id: number, status: 'approved' | 'rejected') {
  return alovaInstance.Post<IAdminComment>(`/comment/${id}/approve`, { status })
}

export function getCommentDeleteImpact(id: number) {
  return alovaInstance.Get<IDeleteImpact>(`/comment/admin/${id}/delete-impact`)
}

export function deleteComment(id: number) {
  return alovaInstance.Delete<{ deletedCount: number }>(`/comment/${id}`)
}
