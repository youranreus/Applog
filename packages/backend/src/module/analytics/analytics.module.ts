import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AnalyticsDailyStatEntity,
  AnalyticsDailyVisitorEntity,
  AnalyticsViewHitEntity,
  PostEntity,
  PageEntity,
} from '@/entities';
import { SystemConfigModule } from '@/module/system-config/system-config.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UmamiClient } from './umami.client';

/**
 * Analytics 模块：Umami 代理查询与 Tracker 引导
 * 旧 analytics_* 实体保留注册（不硬删表），本模块不再写入
 */
@Module({
  imports: [
    SystemConfigModule,
    TypeOrmModule.forFeature([
      AnalyticsDailyStatEntity,
      AnalyticsDailyVisitorEntity,
      AnalyticsViewHitEntity,
      PostEntity,
      PageEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, UmamiClient],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
