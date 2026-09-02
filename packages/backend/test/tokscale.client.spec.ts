import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import axios from 'axios';
import {
  TokscaleClient,
  TokscaleClientError,
} from '../src/module/tokscale/tokscale.client';

function client(logs: string[] = []): TokscaleClient {
  const value = new TokscaleClient();
  Object.assign(value, {
    logger: { warn: (message: string) => logs.push(message) },
    sleep: async () => undefined,
  });
  return value;
}

describe('TokscaleClient', () => {
  it('请求公开 profile URL，并固定 period=month/15s timeout', async () => {
    const original = axios.get;
    axios.get = (async (url: string, options: Record<string, unknown>) => {
      assert.equal(url, 'https://tokscale.ai/api/users/youranreus');
      assert.deepEqual(options.params, { period: 'month' });
      assert.equal(options.timeout, 15_000);
      assert.equal(options.maxRedirects, 5);
      assert.deepEqual(options.headers, { Accept: 'application/json' });
      return { data: { contributions: [] } };
    }) as typeof axios.get;
    try {
      await client().getUserProfile('youranreus');
    } finally {
      axios.get = original;
    }
  });

  it('404/409/429 归类且错误与日志不含 username', async () => {
    const original = axios.get;
    const username = 'secret-user';
    try {
      for (const [status, kind] of [
        [404, 'not_found'],
        [409, 'ambiguous'],
        [429, 'rate_limited'],
      ] as const) {
        const logs: string[] = [];
        axios.get = (async () => {
          throw { response: { status }, message: `body mentions ${username}` };
        }) as typeof axios.get;
        await assert.rejects(
          client(logs).getUserProfile(username),
          (error: unknown) =>
            error instanceof TokscaleClientError &&
            error.kind === kind &&
            !error.message.includes(username),
        );
        assert.equal(
          logs.some((message) => message.includes(username)),
          false,
        );
      }
    } finally {
      axios.get = original;
    }
  });

  it('网络超时仅重试一次，耗尽后归类 timeout', async () => {
    const original = axios.get;
    let calls = 0;
    axios.get = (async () => {
      calls += 1;
      throw { code: 'ECONNABORTED' };
    }) as typeof axios.get;
    try {
      await assert.rejects(
        client().getUserProfile('youranreus'),
        (error: unknown) =>
          error instanceof TokscaleClientError && error.kind === 'timeout',
      );
      assert.equal(calls, 2);
    } finally {
      axios.get = original;
    }
  });
});
