import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { IGarminLandingStats } from '@applog/common';
import {
  GarminActivitySnapshotEntity,
  GarminSyncStateEntity,
} from '@/entities';
import { Repository } from 'typeorm';

const GARMIN_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class GarminService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private now = (): Date => new Date();

  constructor(
    @InjectRepository(GarminActivitySnapshotEntity)
    private readonly activityRepository: Repository<GarminActivitySnapshotEntity>,
    @InjectRepository(GarminSyncStateEntity)
    private readonly stateRepository: Repository<GarminSyncStateEntity>,
  ) {}

  /** 读取 worker 已落库的公开 Landing 快照。 */
  async getLandingStats(): Promise<IGarminLandingStats | null> {
    try {
      const state = await this.stateRepository.findOne({ where: { id: 1 } });
      if (!state?.lastSuccessfulAt) return null;

      const activities = await this.activityRepository.find({
        where: { published: true },
        order: { startedAt: 'DESC' },
        take: 6,
      });
      const fetchedAt = state.lastSuccessfulAt;
      const stale =
        state.status !== 'healthy' ||
        this.now().getTime() - fetchedAt.getTime() > GARMIN_STALE_AFTER_MS;

      return {
        totalActivityCount: state.totalActivityCount,
        activities: activities.map((activity) => ({
          type: activity.activityType,
          typeDisplay: activity.activityTypeDisplay,
          date: activity.startedAt.toISOString(),
          distanceMeters: activity.distanceMeters,
          durationSeconds: activity.durationSeconds,
          calories: activity.calories,
          locationName: activity.locationName,
          deviceSource: activity.deviceSource,
          route:
            activity.routePathData && activity.routeViewBox
              ? {
                  pathData: activity.routePathData,
                  viewBox: activity.routeViewBox,
                }
              : null,
        })),
        fetchedAt: fetchedAt.toISOString(),
        stale,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`Garmin 快照读取失败: ${message}`, GarminService.name);
      throw new BusinessException('运动数据暂时不可用，请稍后重试');
    }
  }
}
