import type { UserRole } from '@/utils/types';

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
