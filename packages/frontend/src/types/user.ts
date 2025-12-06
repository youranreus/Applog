/**
 * 用户角色类型
 */
export type UserRole = 'admin' | 'user';

/**
 * 用户信息响应 DTO
 */
export interface IUserResponseDto {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 登录响应 DTO
 */
export interface ILoginResponseDto {
  user: IUserResponseDto;
  token: string;
}

/**
 * SSO 回调参数
 */
export interface ISsoCallbackParams {
  code: string;
  state?: string;
}

/**
 * SSO Token 交换请求参数
 */
export interface IExchangeSsoTokenParams {
  code: string;
}

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

