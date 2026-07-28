import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { GarminService } from '../src/module/garmin/garmin.service';

const NOW = new Date('2026-07-28T12:00:00.000Z');

function createService(options?: {
  state?: Record<string, unknown> | null;
  activities?: Array<Record<string, unknown>>;
}) {
  const state = options?.state ?? null;
  const activities = options?.activities ?? [];
  const activityRepository = {
    find: async (query: Record<string, unknown>) => {
      assert.deepEqual(query, {
        where: { published: true },
        order: { startedAt: 'DESC' },
        take: 6,
      });
      return activities;
    },
  };
  const stateRepository = {
    findOne: async () => state,
  };
  const service = new GarminService(
    activityRepository as never,
    stateRepository as never,
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
      activityType: 'running',
      activityTypeDisplay: '跑步',
      startedAt: new Date(
        `2026-07-${String(28 - index).padStart(2, '0')}T06:00:00.000Z`,
      ),
      distanceMeters: 5000 + index,
      durationSeconds: 1800 + index,
      deviceSource: 'Forerunner',
      routePathData: 'M 4 96 L 96 4',
      routeViewBox: '0 0 100 100',
      latitude: 10.1,
      longitude: 20.1,
    }));
    const service = createService({
      state: {
        totalActivityCount: 128,
        lastSuccessfulAt: new Date('2026-07-28T10:00:00.000Z'),
        status: 'healthy',
      },
      activities,
    });

    const result = await service.getLandingStats();

    assert.equal(result?.totalActivityCount, 128);
    assert.equal(result?.activities.length, 6);
    assert.equal(result?.stale, false);
    assert.deepEqual(result?.activities[0], {
      type: 'running',
      typeDisplay: '跑步',
      date: '2026-07-28T06:00:00.000Z',
      distanceMeters: 5000,
      durationSeconds: 1800,
      deviceSource: 'Forerunner',
      route: { pathData: 'M 4 96 L 96 4', viewBox: '0 0 100 100' },
    });
    assert.equal(JSON.stringify(result).includes('private-'), false);
    assert.equal(JSON.stringify(result).includes('latitude'), false);
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
});
