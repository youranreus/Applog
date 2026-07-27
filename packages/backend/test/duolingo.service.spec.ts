import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { IDuolingoConfig } from '@applog/common';
import { DuolingoService } from '../src/module/duolingo/duolingo.service';

const CONFIG: IDuolingoConfig = {
  username: 'learner',
  jwt: 'private-token',
  timeZone: 'Asia/Shanghai',
  enabled: true,
};

function attachLogger(service: DuolingoService): void {
  Object.assign(service, {
    logger: {
      warn: () => undefined,
    },
  });
}

function rawData(xp: number) {
  return {
    user: { site_streak: xp, courses: [] },
    summaries: {
      summaries: [
        {
          date: new Date().toISOString().slice(0, 10),
          gainedXp: xp,
          totalSessionTime: xp,
        },
      ],
    },
  };
}

describe('DuolingoService cache', () => {
  it('同 generation 并发请求合并为一次上游调用', async () => {
    let resolveRequest!: (value: ReturnType<typeof rawData>) => void;
    const pending = new Promise<ReturnType<typeof rawData>>((resolve) => {
      resolveRequest = resolve;
    });
    let requests = 0;
    const service = new DuolingoService(
      {
        getLandingData: async () => {
          requests += 1;
          return pending;
        },
      } as never,
      { getDuolingoConfigRaw: async () => CONFIG } as never,
    );
    attachLogger(service);

    const first = service.getLandingStats();
    const second = service.getLandingStats();
    resolveRequest(rawData(12));

    assert.equal((await first)?.streakDays, 12);
    assert.equal((await second)?.streakDays, 12);
    assert.equal(requests, 1);
  });

  it('首次失败进入短失败缓存，不持续击穿上游', async () => {
    let requests = 0;
    const service = new DuolingoService(
      {
        getLandingData: async () => {
          requests += 1;
          throw new Error('network');
        },
      } as never,
      { getDuolingoConfigRaw: async () => CONFIG } as never,
    );
    attachLogger(service);

    assert.equal(await service.getLandingStats(), null);
    assert.equal(await service.getLandingStats(), null);
    assert.equal(requests, 1);
  });

  it('过期快照立即 stale 返回，并在后台刷新', async () => {
    let resolveRequest!: (value: ReturnType<typeof rawData>) => void;
    const pending = new Promise<ReturnType<typeof rawData>>((resolve) => {
      resolveRequest = resolve;
    });
    const service = new DuolingoService(
      { getLandingData: async () => pending } as never,
      { getDuolingoConfigRaw: async () => CONFIG } as never,
    );
    attachLogger(service);
    Object.assign(service, {
      cache: {
        snapshot: {
          streakDays: 5,
          league: null,
          last7Days: {
            totalXp: 0,
            totalLearningSeconds: 0,
            days: [],
          },
          languages: [],
          yearlyXp: { year: 2026, days: [] },
          fetchedAt: '2026-01-01T00:00:00.000Z',
          stale: false,
        },
        expiresAt: 0,
        failureUntil: 0,
      },
    });

    const stale = await service.getLandingStats();
    assert.equal(stale?.stale, true);
    assert.equal(stale?.streakDays, 5);
    resolveRequest(rawData(9));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await service.getLandingStats())?.streakDays, 9);
  });

  it('过期快照刷新失败后，失败 TTL 内不重复请求上游', async () => {
    let requests = 0;
    const service = new DuolingoService(
      {
        getLandingData: async () => {
          requests += 1;
          throw new Error('network');
        },
      } as never,
      { getDuolingoConfigRaw: async () => CONFIG } as never,
    );
    attachLogger(service);
    Object.assign(service, {
      cache: {
        snapshot: {
          streakDays: 5,
          league: null,
          last7Days: {
            totalXp: 0,
            totalLearningSeconds: 0,
            days: [],
          },
          languages: [],
          yearlyXp: { year: 2026, days: [] },
          fetchedAt: '2026-01-01T00:00:00.000Z',
          stale: false,
        },
        expiresAt: 0,
        failureUntil: 0,
      },
    });

    assert.equal((await service.getLandingStats())?.stale, true);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await service.getLandingStats())?.stale, true);
    assert.equal(requests, 1);
  });

  it('保存配置后旧 generation 的结果既不写缓存也不返回给旧调用方', async () => {
    let resolveOld!: (value: ReturnType<typeof rawData>) => void;
    let resolveNew!: (value: ReturnType<typeof rawData>) => void;
    const oldRequest = new Promise<ReturnType<typeof rawData>>((resolve) => {
      resolveOld = resolve;
    });
    const newRequest = new Promise<ReturnType<typeof rawData>>((resolve) => {
      resolveNew = resolve;
    });
    let request = 0;
    const configService = {
      getDuolingoConfigRaw: async () => CONFIG,
      setDuolingoConfig: async () => ({ ...CONFIG, jwt: '********' }),
    };
    const service = new DuolingoService(
      {
        getLandingData: async () => (request++ === 0 ? oldRequest : newRequest),
      } as never,
      configService as never,
    );
    attachLogger(service);

    const oldResult = service.getLandingStats();
    await service.setConfig(CONFIG, { role: 0 } as never);
    const newResult = service.getLandingStats();
    resolveOld(rawData(1));
    resolveNew(rawData(2));

    assert.equal(await oldResult, null);
    assert.equal((await newResult)?.streakDays, 2);
    assert.equal((await service.getLandingStats())?.streakDays, 2);
  });
});
