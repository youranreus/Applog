import { IsEnum, IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import type { AnalyticsContentType } from '@/entities';

/**
 * 上报浏览事件请求体
 */
export class ReportViewDto {
  @IsUUID('4', { message: 'visitorId 必须是合法的 UUID' })
  @IsNotEmpty({ message: 'visitorId 不能为空' })
  visitorId: string;

  @IsEnum(['post', 'page'], {
    message: 'contentType 只能是 post 或 page',
  })
  contentType: AnalyticsContentType;

  @IsInt({ message: 'contentId 必须是整数' })
  @Min(1, { message: 'contentId 必须大于 0' })
  contentId: number;
}
