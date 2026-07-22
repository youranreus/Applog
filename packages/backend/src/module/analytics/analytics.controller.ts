import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { AnalyticsService } from './analytics.service';
import {
  ReportViewDto,
  QueryTrendDto,
  QueryTopDto,
  type IAnalyticsSummaryDto,
  type IAnalyticsTrendPointDto,
  type IAnalyticsTopItemDto,
} from './dto';
import {
  ANALYTICS_DEFAULT_TOP_LIMIT,
  ANALYTICS_DEFAULT_TREND_DAYS,
} from './analytics.constants';

/**
 * Analytics 控制器
 * 公开上报 + 管理员查询
 */
@Controller({
  path: 'analytics',
  version: [VERSION_NEUTRAL, '1'],
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 上报内容浏览（公开，可选登录）
   * @param dto - 上报参数
   * @param user - 可选当前用户
   * @returns 空对象
   */
  @Post('view')
  async reportView(
    @Body() dto: ReportViewDto,
    @UserParams() user?: UserJwtPayload,
  ): Promise<Record<string, never>> {
    return this.analyticsService.reportView(dto, user);
  }

  /**
   * 站点流量摘要（今日 + 近 7 日）
   * @returns 摘要数据
   */
  @Get('summary')
  @AuthRoles('admin')
  async getSummary(): Promise<IAnalyticsSummaryDto> {
    return this.analyticsService.getSummary();
  }

  /**
   * 站点日趋势序列
   * @param query - days 可选，默认 30
   * @returns 日序列（缺日补 0）
   */
  @Get('trend')
  @AuthRoles('admin')
  async getTrend(
    @Query() query: QueryTrendDto,
  ): Promise<IAnalyticsTrendPointDto[]> {
    return this.analyticsService.getTrend(
      query.days ?? ANALYTICS_DEFAULT_TREND_DAYS,
    );
  }

  /**
   * 内容 Top 榜
   * @param query - type / days / limit
   * @returns Top 列表
   */
  @Get('top')
  @AuthRoles('admin')
  async getTop(@Query() query: QueryTopDto): Promise<IAnalyticsTopItemDto[]> {
    return this.analyticsService.getTop(
      query.type,
      query.days ?? ANALYTICS_DEFAULT_TREND_DAYS,
      query.limit ?? ANALYTICS_DEFAULT_TOP_LIMIT,
    );
  }
}
