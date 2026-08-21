import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { IWakaTimeConfig } from '@applog/common';
import { WakaTimeService } from '../src/module/wakatime/wakatime.service';
import { getWakaTimeDateRange } from '../src/module/wakatime/wakatime.utils';

const CONFIG: IWakaTimeConfig = {
  apiKey: 'secret',
  timeZone: 'UTC',
  enabled: true,
};

function payload() {
  const range = getWakaTimeDateRange('UTC');
  const data = [];
  for (let date = range.startDate; date <= range.endDate; ) {
    data.push({
      range: { date },
      grand_total: {
        total_seconds: 60,
        ai_additions: 1,
        ai_deletions: 0,
        human_additions: 1,
        human_deletions: 0,
      },
      languages: [],
      editors: [],
    });
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
  }
  return { data };
}

function service(client: object, configService: object): WakaTimeService {
  const value = new WakaTimeService(client as never, configService as never);
  Object.assign(value, { logger: { warn: () => undefined } });
  return value;
}

describe('WakaTimeService snapshot refresh', () => {
  it('公开读不触发上游，同 generation 后台刷新 single-flight', async () => {
    let requests = 0;
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => {
      resolve = done;
    });
    const value = service(
      {
        getSummaries: async () => {
          requests += 1;
          return pending;
        },
      },
      { getWakaTimeConfigRaw: async () => CONFIG },
    );
    assert.equal(value.getLandingStats(), null);
    const first = value.refreshFromStoredConfig();
    const second = value.refreshFromStoredConfig();
    resolve(payload());
    await Promise.all([first, second]);
    assert.equal(requests, 1);
    assert.equal(value.getLandingStats()?.summary30Days.totalSeconds, 1800);
  });

  it('刷新失败保留 last-known-good 并标记 stale', async () => {
    let fail = false;
    const value = service(
      {
        getSummaries: async () => {
          if (fail) throw new Error('network');
          return payload();
        },
      },
      { getWakaTimeConfigRaw: async () => CONFIG },
    );
    await value.refreshFromStoredConfig();
    fail = true;
    Object.assign(value, {
      cache: {
        snapshot: value.getLandingStats(),
        expiresAt: 0,
        failureUntil: 0,
      },
    });
    await value.refreshFromStoredConfig();
    assert.equal(value.getLandingStats()?.stale, true);
  });

  it('首次失败进入短失败缓存，不重复击穿上游', async () => {
    let requests = 0;
    const value = service(
      {
        getSummaries: async () => {
          requests += 1;
          throw new Error('network');
        },
      },
      { getWakaTimeConfigRaw: async () => CONFIG },
    );
    assert.equal(await value.refreshFromStoredConfig(), null);
    assert.equal(await value.refreshFromStoredConfig(), null);
    assert.equal(requests, 1);
  });

  it('禁用配置不请求上游且清空快照', async () => {
    let requests = 0;
    const value = service(
      {
        getSummaries: async () => {
          requests += 1;
          return payload();
        },
      },
      { getWakaTimeConfigRaw: async () => ({ ...CONFIG, enabled: false }) },
    );
    await value.refreshFromStoredConfig();
    assert.equal(requests, 0);
    assert.equal(value.getLandingStats(), null);
  });

  it('配置保存后旧 generation 结果不能回填快照', async () => {
    let resolveOld!: (value: unknown) => void;
    let resolveNew!: (value: unknown) => void;
    const oldPayload = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const newPayload = new Promise((resolve) => {
      resolveNew = resolve;
    });
    let requests = 0;
    const configService = {
      getWakaTimeConfigRaw: async () => CONFIG,
      setWakaTimeConfig: async () => ({ ...CONFIG, apiKey: '********' }),
    };
    const value = service(
      {
        getSummaries: async () => (requests++ === 0 ? oldPayload : newPayload),
      },
      configService,
    );

    const oldRefresh = value.refreshFromStoredConfig();
    await value.setConfig(CONFIG, { role: 0 } as never);
    resolveOld(payload());
    assert.equal(await oldRefresh, null);
    resolveNew(payload());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(value.getLandingStats()?.summary30Days.totalSeconds, 1800);
  });

  it('生命周期定时器会 unref 并在销毁时清理', () => {
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let unrefCalled = false;
    let cleared: unknown;
    const timer = { unref: () => (unrefCalled = true) };
    global.setInterval = (() => timer) as unknown as typeof setInterval;
    global.clearInterval = ((value: unknown) => {
      cleared = value;
    }) as typeof clearInterval;
    try {
      const value = service(
        { getSummaries: async () => payload() },
        { getWakaTimeConfigRaw: async () => ({ ...CONFIG, enabled: false }) },
      );
      value.onModuleInit();
      assert.equal(unrefCalled, true);
      value.onModuleDestroy();
      assert.equal(cleared, timer);
    } finally {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });
});
