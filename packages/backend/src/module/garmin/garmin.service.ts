import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type {
  IGarminActivitySplit,
  IGarminLandingActivityDetail,
  IGarminLandingStats,
} from '@applog/common';
import {
  GarminActivityCoverEntity,
  GarminActivitySnapshotEntity,
  GarminSyncStateEntity,
} from '@/entities';
import { In, IsNull, Not, Repository } from 'typeorm';

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
    @InjectRepository(GarminActivityCoverEntity)
    private readonly coverRepository: Repository<GarminActivityCoverEntity>,
  ) {}

  /** 读取 worker 已落库的公开 Landing 快照。 */
  async getLandingStats(): Promise<IGarminLandingStats | null> {
    try {
      const state = await this.stateRepository.findOne({ where: { id: 1 } });
      if (!state?.lastSuccessfulAt) return null;

      const activities = await this.activityRepository.find({
        where: { published: true, publicId: Not(IsNull()) },
        order: { startedAt: 'DESC' },
        take: 6,
      });
      const coverIds = activities
        .map((activity) => activity.coverId)
        .filter((coverId): coverId is string => Boolean(coverId));
      const covers = coverIds.length
        ? await this.coverRepository.find({ where: { coverId: In(coverIds) } })
        : [];
      const coverById = new Map(covers.map((cover) => [cover.coverId, cover]));
      const fetchedAt = state.lastSuccessfulAt;
      const stale =
        state.status !== 'healthy' ||
        this.now().getTime() - fetchedAt.getTime() > GARMIN_STALE_AFTER_MS;

      return {
        totalActivityCount: state.totalActivityCount,
        activities: activities.map((activity) => ({
          publicId: activity.publicId as string,
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
          cover: activity.coverId
            ? this.toPublicCover(coverById.get(activity.coverId))
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

  /** Read an allowlisted detail only while its public projection is published. */
  async getActivityDetail(
    publicId: string,
  ): Promise<IGarminLandingActivityDetail> {
    try {
      const activity = await this.activityRepository.findOne({
        where: { publicId, published: true },
      });
      if (!activity?.detailData) {
        throw new BusinessException('运动详情暂不可用');
      }
      return this.toPublicDetail(activity);
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logUnexpected('Garmin 详情读取失败', error);
      throw new BusinessException('运动详情暂时不可用，请稍后重试');
    }
  }

  /** Return one already-public cover media record. */
  async getCover(coverId: string): Promise<GarminActivityCoverEntity> {
    try {
      const cover = await this.coverRepository.findOne({ where: { coverId } });
      if (!cover) throw new BusinessException('运动封面不存在');
      const publishedActivity = await this.activityRepository.findOne({
        where: { coverId, published: true },
        select: { id: true },
      });
      if (!publishedActivity) throw new BusinessException('运动封面不存在');
      return cover;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logUnexpected('Garmin 封面读取失败', error);
      throw new BusinessException('运动封面暂时不可用，请稍后重试');
    }
  }

  private toPublicCover(cover?: GarminActivityCoverEntity) {
    if (!cover) return null;
    return {
      url: `/garmin/covers/${cover.coverId}.webp`,
      width: cover.width,
      height: cover.height,
      attribution: cover.attribution,
    };
  }

  private toPublicDetail(
    activity: GarminActivitySnapshotEntity,
  ): IGarminLandingActivityDetail {
    const data = activity.detailData ?? {};
    const numberOrNull = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    const splits = Array.isArray(data.splits)
      ? data.splits.slice(0, 12).map((value, index): IGarminActivitySplit => {
          const split =
            value && typeof value === 'object'
              ? (value as Record<string, unknown>)
              : {};
          return {
            index: typeof split.index === 'number' ? split.index : index + 1,
            type: typeof split.type === 'string' ? split.type : null,
            distanceMeters: numberOrNull(split.distanceMeters),
            durationSeconds: numberOrNull(split.durationSeconds),
            averagePaceSecondsPerKm: numberOrNull(
              split.averagePaceSecondsPerKm,
            ),
            averageHeartRateBpm: numberOrNull(split.averageHeartRateBpm),
          };
        })
      : [];
    return {
      publicId: activity.publicId,
      type: activity.activityType,
      typeDisplay: activity.activityTypeDisplay,
      date: activity.startedAt.toISOString(),
      distanceMeters: activity.distanceMeters,
      durationSeconds: activity.durationSeconds,
      movingDurationSeconds: numberOrNull(data.movingDurationSeconds),
      calories: activity.calories,
      averagePaceSecondsPerKm: numberOrNull(data.averagePaceSecondsPerKm),
      averageSpeedMetersPerSecond: numberOrNull(
        data.averageSpeedMetersPerSecond,
      ),
      maxSpeedMetersPerSecond: numberOrNull(data.maxSpeedMetersPerSecond),
      averageHeartRateBpm: numberOrNull(data.averageHeartRateBpm),
      maxHeartRateBpm: numberOrNull(data.maxHeartRateBpm),
      elevationGainMeters: numberOrNull(data.elevationGainMeters),
      averageCadencePerMinute: numberOrNull(data.averageCadencePerMinute),
      averagePowerWatts: numberOrNull(data.averagePowerWatts),
      trainingEffect: numberOrNull(data.trainingEffect),
      anaerobicTrainingEffect: numberOrNull(data.anaerobicTrainingEffect),
      activityTrainingLoad: numberOrNull(data.activityTrainingLoad),
      bodyBatteryDelta: numberOrNull(data.bodyBatteryDelta),
      steps: numberOrNull(data.steps),
      lapCount: numberOrNull(data.lapCount),
      splits,
    };
  }

  private logUnexpected(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'unknown';
    this.logger.error(`${prefix}: ${message}`, GarminService.name);
  }
}
