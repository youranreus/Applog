import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TokscaleService } from '../src/module/tokscale/tokscale.service';

function payload(tokens = 10) {
  return {
    updatedAt: '2026-09-02T00:00:00.000Z',
    contributions: [
      {
        date: '2026-09-02',
        totals: { tokens, cost: 0.1, messages: 0 },
        tokenBreakdown: {
          input: tokens,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          reasoning: 0,
        },
        clients: [
          {
            client: 'pi',
            modelId: '',
            models: {
              'gpt-test': {
                tokens,
                cost: 0.1,
                input: tokens,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                reasoning: 0,
              },
            },
            tokens: {
              input: tokens,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              reasoning: 0,
            },
            cost: 0.1,
          },
        ],
      },
    ],
  };
}

function service(client: object, configService: object): TokscaleService {
  const systemConfigService = {
    onBaseConfigChanged: () => () => undefined,
    ...configService,
  };
  const value = new TokscaleService(
    client as never,
    systemConfigService as never,
  );
  Object.assign(value, { logger: { warn: () => undefined } });
  return value;
}

describe('TokscaleService snapshot refresh', () => {
  it('公开读不触发上游，同 generation 后台刷新 single-flight', async () => {
    let requests = 0;
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => {
      resolve = done;
    });
    const value = service(
      {
        getUserProfile: async () => {
          requests += 1;
          return pending;
        },
      },
      { getBaseConfigRaw: async () => ({ tokscaleUsername: 'youranreus' }) },
    );
    assert.equal(value.getLandingStats(), null);
    const first = value.refreshFromStoredConfig();
    const second = value.refreshFromStoredConfig();
    resolve(payload());
    await Promise.all([first, second]);
    assert.equal(requests, 1);
    assert.equal(value.getLandingStats()?.totalTokens, 10);
  });

  it('刷新失败保留 last-known-good 并标记 stale，随后进入失败抑制', async () => {
    let fail = false;
    let requests = 0;
    const value = service(
      {
        getUserProfile: async () => {
          requests += 1;
          if (fail) throw new Error('network');
          return payload();
        },
      },
      { getBaseConfigRaw: async () => ({ tokscaleUsername: 'youranreus' }) },
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
    assert.equal((await value.refreshFromStoredConfig())?.stale, true);
    assert.equal((await value.refreshFromStoredConfig())?.stale, true);
    assert.equal(requests, 2);
  });

  it('成功 TTL 内重复刷新不击穿上游', async () => {
    let requests = 0;
    const value = service(
      {
        getUserProfile: async () => {
          requests += 1;
          return payload();
        },
      },
      { getBaseConfigRaw: async () => ({ tokscaleUsername: 'youranreus' }) },
    );
    await value.refreshFromStoredConfig();
    await value.refreshFromStoredConfig();
    assert.equal(requests, 1);
  });

  it('首次失败进入短失败缓存，不重复击穿上游', async () => {
    let requests = 0;
    const value = service(
      {
        getUserProfile: async () => {
          requests += 1;
          throw new Error('network');
        },
      },
      { getBaseConfigRaw: async () => ({ tokscaleUsername: 'youranreus' }) },
    );
    assert.equal(await value.refreshFromStoredConfig(), null);
    assert.equal(await value.refreshFromStoredConfig(), null);
    assert.equal(requests, 1);
  });

  it('username 为空时不请求上游且清空快照', async () => {
    let requests = 0;
    let config = { tokscaleUsername: 'youranreus' };
    const value = service(
      {
        getUserProfile: async () => {
          requests += 1;
          return payload();
        },
      },
      { getBaseConfigRaw: async () => config },
    );
    await value.refreshFromStoredConfig();
    config = { tokscaleUsername: '' };
    await value.refreshFromStoredConfig();
    assert.equal(requests, 1);
    assert.equal(value.getLandingStats(), null);
  });

  it('username 变更清空旧快照，旧 generation 结果不能回填', async () => {
    let resolveOld!: (value: unknown) => void;
    let resolveNew!: (value: unknown) => void;
    const oldPayload = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const newPayload = new Promise((resolve) => {
      resolveNew = resolve;
    });
    let username = 'alice';
    const value = service(
      {
        getUserProfile: async (requested: string) =>
          requested === 'alice' ? oldPayload : newPayload,
      },
      { getBaseConfigRaw: async () => ({ tokscaleUsername: username }) },
    );

    const oldRefresh = value.refreshFromStoredConfig();
    username = 'bob';
    const newRefresh = value.refreshFromStoredConfig();
    assert.equal(value.getLandingStats(), null);
    resolveOld(payload(10));
    assert.equal(await oldRefresh, null);
    resolveNew(payload(20));
    await newRefresh;
    assert.equal(value.getLandingStats()?.totalTokens, 20);
  });

  it('base config 保存成功后会立即触发后台刷新', async () => {
    let listener: (() => void) | undefined;
    let requests = 0;
    let config = { tokscaleUsername: '' };
    const value = service(
      {
        getUserProfile: async () => {
          requests += 1;
          return payload(30);
        },
      },
      {
        getBaseConfigRaw: async () => config,
        onBaseConfigChanged: (callback: () => void) => {
          listener = callback;
          return () => {
            listener = undefined;
          };
        },
      },
    );

    value.onModuleInit();
    assert.equal(value.getLandingStats(), null);
    config = { tokscaleUsername: 'youranreus' };
    listener?.();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests, 1);
    assert.equal(value.getLandingStats()?.totalTokens, 30);
    value.onModuleDestroy();
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
        { getUserProfile: async () => payload() },
        { getBaseConfigRaw: async () => ({ tokscaleUsername: '' }) },
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
