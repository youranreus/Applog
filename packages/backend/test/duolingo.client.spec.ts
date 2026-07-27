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
  });
  return instance;
}

const config = {
  username: 'learner',
  jwt: 'private-token',
  timeZone: 'Asia/Shanghai',
  enabled: true,
};

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

  it('401/403 只暴露无凭证错误分类', async () => {
    const original = axios.get;
    axios.get = (async () => {
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
    } finally {
      axios.get = original;
    }
  });

  it('超时归一为 timeout', async () => {
    const original = axios.get;
    axios.get = (async () => {
      throw { code: 'ECONNABORTED' };
    }) as typeof axios.get;
    try {
      await assert.rejects(
        client().getLandingData(config, '2026-01-01'),
        (error: unknown) =>
          error instanceof DuolingoClientError && error.kind === 'timeout',
      );
    } finally {
      axios.get = original;
    }
  });
});
