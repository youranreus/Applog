import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AnalyticsDailyStatEntity,
  AnalyticsDailyVisitorEntity,
  AnalyticsViewHitEntity,
  PostEntity,
  PageEntity,
} from '@/entities';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Analytics 模块：PV/UV 上报与管理员查询
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsDailyStatEntity,
      AnalyticsDailyVisitorEntity,
      AnalyticsViewHitEntity,
      PostEntity,
      PageEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
