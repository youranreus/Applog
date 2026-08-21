import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import axios from 'axios';
import {
  WakaTimeClient,
  WakaTimeClientError,
} from '../src/module/wakatime/wakatime.client';

const config = {
  apiKey: 'private-key',
  timeZone: 'Asia/Shanghai',
  enabled: true,
};

function client(): WakaTimeClient {
  const value = new WakaTimeClient();
  Object.assign(value, {
    logger: { warn: () => undefined },
    sleep: async () => undefined,
  });
  return value;
}

describe('WakaTimeClient', () => {
  it('Basic Auth 只出现在 axios auth，不进入 query', async () => {
    const original = axios.get;
    axios.get = (async (_url: string, options: Record<string, unknown>) => {
      assert.deepEqual(options.auth, { username: config.apiKey, password: '' });
      assert.equal(
        JSON.stringify(options.params).includes(config.apiKey),
        false,
      );
      return { data: { data: [] } };
    }) as typeof axios.get;
    try {
      await client().getSummaries(config, '2026-01-01', '2026-01-30');
    } finally {
      axios.get = original;
    }
  });

  it('401/402/429 归一为无凭证错误分类', async () => {
    const original = axios.get;
    try {
      for (const [status, kind] of [
        [401, 'unauthorized'],
        [402, 'payment'],
        [429, 'rate_limited'],
      ] as const) {
        axios.get = (async () => {
          throw { response: { status } };
        }) as typeof axios.get;
        await assert.rejects(
          client().getSummaries(config, '2026-01-01', '2026-01-30'),
          (error: unknown) =>
            error instanceof WakaTimeClientError &&
            error.kind === kind &&
            !error.message.includes(config.apiKey),
        );
      }
    } finally {
      axios.get = original;
    }
  });

  it('网络超时仅重试一次', async () => {
    const original = axios.get;
    let calls = 0;
    axios.get = (async () => {
      calls += 1;
      throw { code: 'ECONNABORTED' };
    }) as typeof axios.get;
    try {
      await assert.rejects(
        client().getSummaries(config, '2026-01-01', '2026-01-30'),
        (error: unknown) =>
          error instanceof WakaTimeClientError && error.kind === 'timeout',
      );
      assert.equal(calls, 2);
    } finally {
      axios.get = original;
    }
  });
});
