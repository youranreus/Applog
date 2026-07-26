import {
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { IVisitorCursorSync } from '@applog/common';

/**
 * 同步访客鼠标位置。
 */
export class SyncVisitorCursorDto implements IVisitorCursorSync {
  @IsUUID('4', { message: '访客键格式不正确' })
  visitorKey: string;

  @IsString()
  @Length(4, 4, { message: '访客 ID 必须为四位' })
  @Matches(/^[0-9A-F]{4}$/, { message: '访客 ID 格式不正确' })
  displayId: string;

  @IsString()
  @Matches(/^#[0-9A-F]{6}$/i, { message: '访客颜色格式不正确' })
  color: string;

  @IsString()
  @MaxLength(512, { message: '页面路径过长' })
  @Matches(/^\/(?!\/)[^?#\r\n]*$/, { message: '页面路径格式不正确' })
  pagePath: string;

  @IsNumber({}, { message: '横坐标必须为数字' })
  @Min(0, { message: '横坐标不能小于 0' })
  @Max(1, { message: '横坐标不能大于 1' })
  x: number;

  @IsNumber({}, { message: '纵坐标必须为数字' })
  @Min(0, { message: '纵坐标不能小于 0' })
  @Max(1, { message: '纵坐标不能大于 1' })
  y: number;
}
