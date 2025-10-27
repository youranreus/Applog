import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * 更新用户信息 DTO
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: '用户名最多 50 个字符' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '头像地址最多 500 个字符' })
  avatar?: string;
}
