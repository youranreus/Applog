import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { GarminService } from '../src/module/garmin/garmin.service';

const NOW = new Date('2026-07-28T12:00:00.000Z');

function createService(options?: {
  state?: Record<string, unknown> | null;
  activities?: Array<Record<string, unknown>>;
  covers?: Array<Record<string, unknown>>;
}) {
  const state = options?.state ?? null;
  const activities = options?.activities ?? [];
  const activityRepository = {
    find: async (query: Record<string, unknown>) => {
      const where = query.where as Record<string, unknown>;
      assert.equal(where.published, true);
      assert.ok(where.publicId);
      assert.deepEqual(query.order, { startedAt: 'DESC' });
      assert.equal(query.take, 6);
      return activities;
    },
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      activities.find(
        (activity) =>
          activity.coverId === where.coverId && activity.published !== false,
      ) ?? null,
  };
  const stateRepository = {
    findOne: async () => state,
  };
  const coverRepository = {
    find: async () => options?.covers ?? [],
    findOne: async ({ where }: { where: { coverId: string } }) =>
      (options?.covers ?? []).find(
        (cover) => cover.coverId === where.coverId,
      ) ?? null,
  };
  const service = new GarminService(
    activityRepository as never,
    stateRepository as never,
    coverRepository as never,
  );
  Object.assign(service, {
    now: () => NOW,
    logger: { error: () => undefined },
  });
  return service;
}

describe('GarminService public landing snapshot', () => {
  it('首次成功同步前返回 null，且不读取活动', async () => {
    const service = createService();
    assert.equal(await service.getLandingStats(), null);
  });

  it('返回最新六条公开活动，并隐藏来源 ID 与坐标', async () => {
    const activities = Array.from({ length: 6 }, (_, index) => ({
      sourceActivityId: `private-${index}`,
      publicId: `public-${index}`,
      activityType: 'running',
      activityTypeDisplay: '跑步',
      startedAt: new Date(
        `2026-07-${String(28 - index).padStart(2, '0')}T06:00:00.000Z`,
      ),
      distanceMeters: 5000 + index,
      durationSeconds: 1800 + index,
      calories: 340 + index,
      locationName: index === 0 ? '深圳湾公园' : null,
      deviceSource: 'Forerunner',
      routePathData: 'M 4 96 L 96 4',
      routeViewBox: '0 0 100 100',
      coverId: index === 0 ? 'cover-0' : null,
      latitude: 10.1,
      longitude: 20.1,
      detailData:
        index === 0
          ? {
              averageHeartRateBpm: 148,
              averagePowerWatts: 215,
              steps: 4200,
              splits: [{ index: 1 }],
              rawPayload: { secret: true },
            }
          : null,
    }));
    const service = createService({
      state: {
        totalActivityCount: 128,
        lastSuccessfulAt: new Date('2026-07-28T10:00:00.000Z'),
        status: 'healthy',
      },
      activities,
      covers: [
        {
          coverId: 'cover-0',
          width: 480,
          height: 480,
          attribution: 'Map provider',
        },
      ],
    });

    const result = await service.getLandingStats();

    assert.equal(result?.totalActivityCount, 128);
    assert.equal(result?.activities.length, 6);
    assert.equal(result?.stale, false);
    assert.deepEqual(result?.activities[0], {
      publicId: 'public-0',
      type: 'running',
      typeDisplay: '跑步',
      date: '2026-07-28T06:00:00.000Z',
      distanceMeters: 5000,
      durationSeconds: 1800,
      calories: 340,
      locationName: '深圳湾公园',
      deviceSource: 'Forerunner',
      route: { pathData: 'M 4 96 L 96 4', viewBox: '0 0 100 100' },
      cover: {
        url: '/garmin/covers/cover-0.webp',
        width: 480,
        height: 480,
        attribution: 'Map provider',
      },
      metrics: {
        averagePaceSecondsPerKm: null,
        averageHeartRateBpm: 148,
        maxHeartRateBpm: null,
        averageCadencePerMinute: null,
        averagePowerWatts: 215,
        trainingEffect: null,
        steps: 4200,
      },
    });
    assert.equal(JSON.stringify(result).includes('private-'), false);
    assert.equal(JSON.stringify(result).includes('latitude'), false);
    assert.equal(JSON.stringify(result).includes('longitude'), false);
    assert.equal(JSON.stringify(result).includes('sourceActivityId'), false);
    assert.equal(JSON.stringify(result).includes('splits'), false);
    assert.equal(JSON.stringify(result).includes('rawPayload'), false);
  });

  it('同步失败或超过六小时仍返回最后快照，但标记 stale', async () => {
    for (const state of [
      {
        totalActivityCount: 12,
        lastSuccessfulAt: new Date('2026-07-28T11:00:00.000Z'),
        status: 'degraded',
      },
      {
        totalActivityCount: 12,
        lastSuccessfulAt: new Date('2026-07-28T05:59:59.999Z'),
        status: 'healthy',
      },
    ]) {
      const result = await createService({ state }).getLandingStats();
      assert.equal(result?.stale, true);
      assert.equal(result?.fetchedAt, state.lastSuccessfulAt.toISOString());
    }
  });

  it('详情按 publicId 和 published 查询，并重新执行字段白名单', async () => {
    const activityRepository = {
      findOne: async (query: Record<string, unknown>) => {
        assert.deepEqual(query, {
          where: { publicId: 'public-1', published: true },
        });
        return {
          publicId: 'public-1',
          sourceActivityId: 'private-source',
          activityType: 'running',
          activityTypeDisplay: '跑步',
          startedAt: NOW,
          distanceMeters: 5000,
          durationSeconds: 1800,
          calories: 300,
          detailData: {
            averageHeartRateBpm: 150,
            anaerobicTrainingEffect: 1.5,
            activityTrainingLoad: 64,
            steps: 3200,
            latitude: 22.5,
            rawPayload: { secret: true },
            splits: [{ index: 1, durationSeconds: 300, longitude: 114 }],
          },
        };
      },
    };
    const service = new GarminService(
      activityRepository as never,
      {} as never,
      {} as never,
    );
    Object.assign(service, { logger: { error: () => undefined } });

    const result = await service.getActivityDetail('public-1');
    const json = JSON.stringify(result);
    assert.equal(result.averageHeartRateBpm, 150);
    assert.equal(result.anaerobicTrainingEffect, 1.5);
    assert.equal(result.activityTrainingLoad, 64);
    assert.equal(result.steps, 3200);
    assert.equal(result.splits[0]?.durationSeconds, 300);
    assert.equal(json.includes('sourceActivityId'), false);
    assert.equal(json.includes('latitude'), false);
    assert.equal(json.includes('longitude'), false);
    assert.equal(json.includes('rawPayload'), false);
  });

  it('封面退出公开投影后不可继续读取', async () => {
    const publicService = createService({
      activities: [
        { id: 'snapshot', coverId: 'cover-public', published: true },
      ],
      covers: [{ coverId: 'cover-public' }],
    });
    assert.equal(
      (await publicService.getCover('cover-public')).coverId,
      'cover-public',
    );

    const withdrawnService = createService({
      activities: [
        { id: 'snapshot', coverId: 'cover-private', published: false },
      ],
      covers: [{ coverId: 'cover-private' }],
    });
    await assert.rejects(() => withdrawnService.getCover('cover-private'));
  });
});
