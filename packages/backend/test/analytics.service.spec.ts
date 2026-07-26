import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AnalyticsService } from '../src/module/analytics/analytics.service';

interface IDeferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('AnalyticsService active visitors cache', () => {
  it('配置更新后忽略旧请求结果，并让后续请求复用新请求', async () => {
    const oldRequest = createDeferred<number | null>();
    const newRequest = createDeferred<number | null>();
    const requests = [oldRequest, newRequest];
    let requestIndex = 0;

    const umamiClient = {
      getActiveVisitors: () => requests[requestIndex++].promise,
      invalidateTokenCache: () => undefined,
    };
    const systemConfigService = {
      setUmamiConfig: async () => ({ enabled: true }),
    };
    const service = new AnalyticsService(
      umamiClient as never,
      systemConfigService as never,
    );
    Object.assign(service, {
      logger: { log: () => undefined, error: () => undefined },
    });

    const staleResult = service.getActiveVisitors();
    await service.setUmamiConfig({} as never, {} as never);
    const freshResult = service.getActiveVisitors();

    oldRequest.resolve(1);
    assert.deepEqual(await staleResult, { visitors: 1 });

    const joinedFreshResult = service.getActiveVisitors();
    newRequest.resolve(2);

    assert.deepEqual(await freshResult, { visitors: 2 });
    assert.deepEqual(await joinedFreshResult, { visitors: 2 });
    assert.equal(requestIndex, 2);
  });
});
