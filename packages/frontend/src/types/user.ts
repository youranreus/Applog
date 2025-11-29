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

