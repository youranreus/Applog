import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import type { IUmamiConfig, IUmamiTrackerConfig } from '@applog/common';
import { AnalyticsService } from './analytics.service';
import {
  QueryTrendDto,
  QueryTopDto,
  QueryBreakdownDto,
  SetUmamiConfigDto,
  type IAnalyticsSummaryDto,
  type IAnalyticsTrendPointDto,
  type IAnalyticsTopItemDto,
  type IAnalyticsBreakdownItemDto,
} from './dto';
import {
  ANALYTICS_DEFAULT_BREAKDOWN_LIMIT,
  ANALYTICS_DEFAULT_TOP_LIMIT,
  ANALYTICS_DEFAULT_TREND_DAYS,
} from './analytics.constants';

/**
 * Analytics 控制器
 * 公开 Tracker 引导 + 管理员 Umami 代理查询与配置
 */
@Controller({
  path: 'analytics',
  version: [VERSION_NEUTRAL, '1'],
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 公开 Tracker 引导（无凭证）
   * @returns enabled / scriptUrl / websiteId
   */
  @Get('tracker-config')
  async getTrackerConfig(): Promise<IUmamiTrackerConfig> {
    return this.analyticsService.getTrackerConfig();
  }

  /**
   * 管理员读取脱敏 Umami 配置
   * @param user - 当前管理员
   * @returns 脱敏配置
   */
  @Get('umami-config')
  @AuthRoles('admin')
  async getUmamiConfig(
    @UserParams() user: UserJwtPayload,
  ): Promise<IUmamiConfig> {
    return this.analyticsService.getUmamiConfig(user);
  }

  /**
   * 管理员保存 Umami 配置
   * @param dto - 表单配置
   * @param user - 当前管理员
   * @returns 脱敏后的最新配置
   */
  @Put('umami-config')
  @AuthRoles('admin')
  async setUmamiConfig(
    @Body() dto: SetUmamiConfigDto,
    @UserParams() user: UserJwtPayload,
  ): Promise<IUmamiConfig> {
    return this.analyticsService.setUmamiConfig(
      {
        baseUrl: dto.baseUrl,
        websiteId: dto.websiteId,
        scriptUrl: dto.scriptUrl ?? '',
        username: dto.username,
        password: dto.password ?? '',
        enabled: dto.enabled,
      },
      user,
    );
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
   * 热门页面 Top（单栏）
   * @param query - days / limit
   * @returns Top 列表
   */
  @Get('top')
  @AuthRoles('admin')
  async getTop(@Query() query: QueryTopDto): Promise<IAnalyticsTopItemDto[]> {
    return this.analyticsService.getTop(
      query.days ?? ANALYTICS_DEFAULT_TREND_DAYS,
      query.limit ?? ANALYTICS_DEFAULT_TOP_LIMIT,
    );
  }

  /**
   * 设备 / OS / 地域分布
   * @param query - dimension / days / limit
   * @returns 分布列表
   */
  @Get('breakdown')
  @AuthRoles('admin')
  async getBreakdown(
    @Query() query: QueryBreakdownDto,
  ): Promise<IAnalyticsBreakdownItemDto[]> {
    return this.analyticsService.getBreakdown(
      query.dimension,
      query.days ?? ANALYTICS_DEFAULT_TREND_DAYS,
      query.limit ?? ANALYTICS_DEFAULT_BREAKDOWN_LIMIT,
    );
  }
}
