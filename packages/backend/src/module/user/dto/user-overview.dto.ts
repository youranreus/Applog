/**
 * 用户创作概览响应 DTO
 */
export interface IUserOverviewDto {
  /** 文章数量 */
  postCount: number;
  /** 页面数量 */
  pageCount: number;
  /** 评论数量（用户发表的评论总数） */
  commentCount: number;
  /** 收到评论的数量（用户作为作者的文章收到的评论总数） */
  receivedCommentCount: number;
}
