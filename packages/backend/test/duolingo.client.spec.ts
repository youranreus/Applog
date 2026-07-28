import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import axios from 'axios';
import {
  DuolingoClient,
  DuolingoClientError,
} from '../src/module/duolingo/duolingo.client';

function client(): DuolingoClient {
  const instance = new DuolingoClient();
  Object.assign(instance, {
    logger: { warn: () => undefined },
    sleep: async () => undefined,
  });
  return instance;
}

const config = {
  username: 'learner',
  jwt: 'private-token',
  timeZone: 'Asia/Shanghai',
  enabled: true,
};

const LOOKUP_URL = 'https://www.duolingo.com/2017-06-30/users';

/**
 * 构造可成功走完 getLandingData 的 axios.get mock。
 * @param onLookup - lookup 阶段钩子（可抛错或计数）
 * @returns 替换用的 get 实现
 */
function successfulGetMock(
  onLookup?: (attempt: number) => void | Promise<void>,
): typeof axios.get {
  let lookupAttempts = 0;
  return (async (url: string) => {
    const href = String(url);
    if (href === LOOKUP_URL) {
      lookupAttempts += 1;
      await onLookup?.(lookupAttempts);
      return { data: { users: [{ id: '42' }] } };
    }
    if (href.includes('/xp_summaries')) {
      return { data: { summaries: [] } };
    }
    return { data: { id: 42, streak: 1 } };
  }) as typeof axios.get;
}

describe('DuolingoClient errors', () => {
  it('lookup 无用户时归一为 schema 错误', async () => {
    const original = axios.get;
    axios.get = (async () => ({ data: { users: [] } })) as typeof axios.get;
    try {
      await assert.rejects(
        client().getLandingData(config, '2026-01-01'),
        (error: unknown) =>
          error instanceof DuolingoClientError && error.kind === 'schema',
      );
    } finally {
      axios.get = original;
    }
  });

  it('lookup 空 userId 时归一为 schema 错误', async () => {
    const original = axios.get;
    axios.get = (async () => ({
      data: { users: [{ id: '  ' }] },
    })) as typeof axios.get;
    try {
      await assert.rejects(
        client().getLandingData(config, '2026-01-01'),
        (error: unknown) =>
          error instanceof DuolingoClientError && error.kind === 'schema',
      );
    } finally {
      axios.get = original;
    }
  });

  it('401/403 只暴露无凭证错误分类且不重试', async () => {
    const original = axios.get;
    let calls = 0;
    axios.get = (async () => {
      calls += 1;
      throw { response: { status: 401 }, config: { headers: config.jwt } };
    }) as typeof axios.get;
    try {
      await assert.rejects(
        client().getLandingData(config, '2026-01-01'),
        (error: unknown) =>
          error instanceof DuolingoClientError &&
          error.kind === 'unauthorized' &&
          !error.message.includes(config.jwt),
      );
      assert.equal(calls, 1);
    } finally {
      axios.get = original;
    }
  });

  it('两次超时后仍归一为 timeout', async () => {
    const original = axios.get;
    let calls = 0;
    axios.get = (async () => {
      calls += 1;
      throw { code: 'ECONNABORTED' };
    }) as typeof axios.get;
    try {
      await assert.rejects(
        client().getLandingData(config, '2026-01-01'),
        (error: unknown) =>
          error instanceof DuolingoClientError && error.kind === 'timeout',
      );
      assert.equal(calls, 2);
    } finally {
      axios.get = original;
    }
  });

  it('lookup 首次超时后重试成功', async () => {
    const original = axios.get;
    let lookupAttempts = 0;
    axios.get = successfulGetMock(async (attempt) => {
      lookupAttempts = attempt;
      if (attempt === 1) {
        throw { code: 'ECONNABORTED' };
      }
    });
    try {
      const data = await client().getLandingData(config, '2026-01-01');
      assert.equal(lookupAttempts, 2);
      assert.ok(data.user);
      assert.ok(data.summaries);
    } finally {
      axios.get = original;
    }
  });
});

describe('DuolingoClient userId cache', () => {
  it('同一 username 第二次 getLandingData 跳过 lookup', async () => {
    const original = axios.get;
    let lookupCalls = 0;
    const urls: string[] = [];
    axios.get = (async (url: string) => {
      const href = String(url);
      urls.push(href);
      if (href === LOOKUP_URL) {
        lookupCalls += 1;
        return { data: { users: [{ id: '99' }] } };
      }
      if (href.includes('/xp_summaries')) {
        return { data: { summaries: [] } };
      }
      return { data: { id: 99 } };
    }) as typeof axios.get;
    try {
      const instance = client();
      await instance.getLandingData(config, '2026-01-01');
      await instance.getLandingData(config, '2026-01-01');
      assert.equal(lookupCalls, 1);
      assert.equal(urls.filter((u) => u === LOOKUP_URL).length, 1);
      assert.ok(
        urls.some((u) => u.includes('/2023-05-23/users/99')),
        '应使用缓存的 userId 请求主数据',
      );
    } finally {
      axios.get = original;
    }
  });

  it('username 变更后重新发起 lookup', async () => {
    const original = axios.get;
    const lookupUsernames: string[] = [];
    axios.get = (async (
      url: string,
      requestConfig?: { params?: { username?: string } },
    ) => {
      const href = String(url);
      if (href === LOOKUP_URL) {
        lookupUsernames.push(requestConfig?.params?.username ?? '');
        const id = requestConfig?.params?.username === 'other' ? '200' : '100';
        return { data: { users: [{ id }] } };
      }
      if (href.includes('/xp_summaries')) {
        return { data: { summaries: [] } };
      }
      return { data: { id: 1 } };
    }) as typeof axios.get;
    try {
      const instance = client();
      await instance.getLandingData(config, '2026-01-01');
      await instance.getLandingData(
        { ...config, username: 'other' },
        '2026-01-01',
      );
      assert.deepEqual(lookupUsernames, ['learner', 'other']);
    } finally {
      axios.get = original;
    }
  });
});
