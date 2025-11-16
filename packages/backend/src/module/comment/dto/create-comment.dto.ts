import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  Length,
  IsEmail,
  IsUrl,
  IsIP,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建评论 DTO
 */
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: '评论内容不能为空' })
  content: string;

  @IsInt()
  @Min(1, { message: '文章ID必须大于0' })
  @Type(() => Number)
  postId: number;

  @IsInt()
  @Min(1, { message: '父评论ID必须大于0' })
  @Type(() => Number)
  @IsOptional()
  parentId?: number;

  @IsString()
  @Length(2, 64, { message: '游客昵称需要在 2-64 个字符之间' })
  @IsOptional()
  guestName?: string;

  @IsEmail({}, { message: '游客邮箱格式不正确' })
  @IsOptional()
  guestEmail?: string;

  @IsUrl({}, { message: '站点地址格式不正确' })
  @IsOptional()
  guestSite?: string;

  @IsIP(undefined, { message: 'IP 地址格式不正确' })
  @IsOptional()
  ip?: string;
}
