import type { IPagination } from './post'

export type CommentStatus = 'pending' | 'approved' | 'rejected'

export interface ICommentAuthor {
  id?: number
  name: string
  avatar?: string
  site?: string
}

export interface IPublicComment {
  id: number
  content: string
  postId: number
  parentId?: number
  status: 'approved' | 'pending'
  author: ICommentAuthor
  createdAt: string
  updatedAt: string
  replies?: IPublicComment[]
}

export interface ICreateComment {
  content: string
  postId: number
  parentId?: number
  guestName?: string
  guestEmail?: string
  guestSite?: string
}

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
