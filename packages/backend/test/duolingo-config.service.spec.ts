import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { DUOLINGO_JWT_MASK } from '@applog/common';
import { SystemConfigService } from '../src/module/system-config/system-config.service';

interface IEntity {
  id: number;
  configKey: string;
  configValue: string;
  description?: string;
  extra?: Record<string, unknown>;
  getData: () => {
    id: number;
    configKey: string;
    configValue: string;
    description?: string;
    extra?: Record<string, unknown>;
  };
}

function makeEntity(value: string): IEntity {
  const entity: IEntity = {
    id: 1,
    configKey: 'SYSTEM_DUOLINGO_CONFIG',
    configValue: value,
    getData: () => ({
      id: entity.id,
      configKey: entity.configKey,
      configValue: entity.configValue,
      description: entity.description,
      extra: entity.extra,
    }),
  };
  return entity;
}

function createService(entity: IEntity) {
  const service = new SystemConfigService({
    get: (_key: string, fallback: unknown) => fallback,
  } as never);
  const repo = {
    findOne: async () => entity,
    find: async () => [entity],
    create: (value: Partial<IEntity>) => Object.assign(entity, value),
    save: async (value: IEntity) => value,
  };
  Object.assign(service, {
    configRepo: repo,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });
  return service;
}

describe('SystemConfigService Duolingo secret boundary', () => {
  it('管理员读回脱敏，空 JWT 更新保留库中明文', async () => {
    const entity = makeEntity(
      JSON.stringify({
        username: 'old',
        jwt: 'stored-secret',
        timeZone: 'Asia/Shanghai',
        enabled: true,
      }),
    );
    const service = createService(entity);
    const user = { role: 0 } as never;

    const masked = await service.getDuolingoConfigMasked(user);
    assert.equal(masked.jwt, DUOLINGO_JWT_MASK);
    const saved = await service.setDuolingoConfig(
      {
        username: 'new',
        jwt: '',
        timeZone: 'Asia/Shanghai',
        enabled: true,
      },
      user,
    );
    assert.equal(saved.jwt, DUOLINGO_JWT_MASK);
    assert.equal(JSON.parse(entity.configValue).jwt, 'stored-secret');
  });

  it('非法时区拒绝保存，通用 setConfig 不允许写 secret key', async () => {
    const service = createService(
      makeEntity(
        JSON.stringify({
          username: '',
          jwt: '',
          timeZone: 'Asia/Shanghai',
          enabled: false,
        }),
      ),
    );
    const user = { role: 0 } as never;
    await assert.rejects(() =>
      service.setDuolingoConfig(
        {
          username: 'name',
          jwt: 'token',
          timeZone: 'Mars/Olympus',
          enabled: true,
        },
        user,
      ),
    );
    await assert.rejects(() =>
      service.setConfig(
        {
          configKey: 'SYSTEM_DUOLINGO_CONFIG',
          configValue: '{}',
        },
        user,
      ),
    );
  });

  it('非管理员不能通过通用 getConfig 读取 secret key', async () => {
    const service = createService(
      makeEntity(
        JSON.stringify({
          username: 'name',
          jwt: 'stored-secret',
          timeZone: 'Asia/Shanghai',
          enabled: true,
        }),
      ),
    );
    await assert.rejects(() =>
      service.getConfig('SYSTEM_DUOLINGO_CONFIG', { role: 1 } as never),
    );
    await assert.rejects(() =>
      service.batchGetConfigs({ keys: ['SYSTEM_DUOLINGO_CONFIG'] }, {
        role: 1,
      } as never),
    );
  });

  it('通用管理员读回在配置 JSON 畸形时也不会泄露原始 JWT', async () => {
    const leakedJwt = 'malformed-secret-token';
    const service = createService(
      makeEntity(`{"username":"learner","jwt":"${leakedJwt}"`),
    );
    const user = { role: 0 } as never;

    const single = await service.getConfig('SYSTEM_DUOLINGO_CONFIG', user);
    assert.ok(single);
    assert.equal(single.configValue.includes(leakedJwt), false);
    assert.deepEqual(JSON.parse(single.configValue), {
      username: '',
      jwt: '',
      timeZone: 'Asia/Shanghai',
      enabled: false,
    });

    const batch = await service.batchGetConfigs(
      { keys: ['SYSTEM_DUOLINGO_CONFIG'] },
      user,
    );
    assert.equal(
      batch.SYSTEM_DUOLINGO_CONFIG?.configValue.includes(leakedJwt),
      false,
    );
  });
});
