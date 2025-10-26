import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 登录请求 DTO
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'ticket 不能为空' })
  ticket: string;
}
