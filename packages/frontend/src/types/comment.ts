import type { IPagination } from './post'

export type CommentStatus = 'pending' | 'approved' | 'rejected'
export type ICommentTarget = { type: 'post'; id: number } | { type: 'page'; id: number }

export interface ICommentAuthor {
  id?: number | string
  name: string
  avatar?: string
  site?: string
}

export interface IPublicComment {
  id: number
  content: string
  postId?: number
  pageId?: number
  parentId?: number
  status: 'approved' | 'pending'
  author: ICommentAuthor
  createdAt: string
  updatedAt: string
  replies?: IPublicComment[]
}

export interface ICommentSubmission {
  content: string
  parentId?: number
  guestName?: string
  guestEmail?: string
  guestSite?: string
}

export type ICreateComment = ICommentSubmission &
  ({ postId: number; pageId?: never } | { pageId: number; postId?: never })

export interface ICreateCommentResponse {
  comment: IPublicComment
  withdrawToken?: string
}
export interface IPendingCapability {
  commentId: number
  token: string
}

export interface IAdminComment extends Omit<IPublicComment, 'author' | 'status'> {
  status: CommentStatus
  author?: ICommentAuthor
  authorId?: number
  guestName?: string
  guestEmail?: string
  guestSite?: string
  ip?: string
  agent?: string
  source?: string
  sourceId?: string
  post?: { id: number; title: string; slug: string }
  page?: { id: number; title: string; slug: string }
  descendantCount: number
}

export interface IDeleteImpact {
  id: number
  descendantCount: number
  totalCount: number
}
export interface ICommentLocation {
  page: number
  rootCommentId: number
}
export type CommentPagination<T> = IPagination<T>
