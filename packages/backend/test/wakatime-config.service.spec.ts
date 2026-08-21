import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { WAKATIME_API_KEY_MASK } from '@applog/common';
import { SystemConfigService } from '../src/module/system-config/system-config.service';

function createService(initial: Record<string, unknown>) {
  const entity = {
    id: 1,
    configKey: 'SYSTEM_WAKATIME_CONFIG',
    configValue: JSON.stringify(initial),
    description: '',
    extra: {},
    getData() {
      return {
        id: this.id,
        configKey: this.configKey,
        configValue: this.configValue,
        description: this.description,
        extra: this.extra,
      };
    },
  };
  const service = new SystemConfigService({
    get: (_key: string, fallback: unknown) => fallback,
  } as never);
  Object.assign(service, {
    configRepo: {
      findOne: async () => entity,
      find: async () => [entity],
      create: (value: object) => Object.assign(entity, value),
      save: async (value: object) => value,
    },
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  });
  return { service, entity };
}

describe('SystemConfigService WakaTime secret boundary', () => {
  it('管理员读回脱敏，空 key 更新保留库中明文', async () => {
    const { service, entity } = createService({
      apiKey: 'stored-secret',
      timeZone: 'Asia/Shanghai',
      enabled: true,
    });
    const user = { role: 0 } as never;
    assert.equal(
      (await service.getWakaTimeConfigMasked(user)).apiKey,
      WAKATIME_API_KEY_MASK,
    );
    const saved = await service.setWakaTimeConfig(
      { apiKey: '', timeZone: 'UTC', enabled: true },
      user,
    );
    assert.equal(saved.apiKey, WAKATIME_API_KEY_MASK);
    assert.equal(JSON.parse(entity.configValue).apiKey, 'stored-secret');
  });

  it('非管理员无法通用读，通用写也不能绕过专用接口', async () => {
    const { service } = createService({
      apiKey: 'secret',
      timeZone: 'UTC',
      enabled: true,
    });
    await assert.rejects(() =>
      service.getConfig('SYSTEM_WAKATIME_CONFIG', { role: 1 } as never),
    );
    await assert.rejects(() =>
      service.setConfig(
        { configKey: 'SYSTEM_WAKATIME_CONFIG', configValue: '{}' },
        { role: 0 } as never,
      ),
    );
    const generic = await service.getConfig('SYSTEM_WAKATIME_CONFIG', {
      role: 0,
    } as never);
    assert.equal(
      JSON.parse(generic?.configValue ?? '{}').apiKey,
      WAKATIME_API_KEY_MASK,
    );
    const batch = await service.batchGetConfigs(
      { keys: ['SYSTEM_WAKATIME_CONFIG'] },
      { role: 0 } as never,
    );
    assert.equal(
      JSON.parse(batch.SYSTEM_WAKATIME_CONFIG?.configValue ?? '{}').apiKey,
      WAKATIME_API_KEY_MASK,
    );
  });

  it('拒绝非法 IANA 时区', async () => {
    const { service } = createService({
      apiKey: 'secret',
      timeZone: 'UTC',
      enabled: true,
    });
    await assert.rejects(() =>
      service.setWakaTimeConfig(
        { apiKey: '', timeZone: 'Mars/Olympus', enabled: true },
        { role: 0 } as never,
      ),
    );
  });

  it('存储失败时日志和对外错误均不转写 API key', async () => {
    const apiKey = 'must-not-enter-logs';
    const { service } = createService({
      apiKey: 'old-secret',
      timeZone: 'UTC',
      enabled: true,
    });
    const logs: string[] = [];
    Object.assign(service, {
      logger: {
        log: () => undefined,
        warn: () => undefined,
        error: (message: string) => logs.push(message),
      },
      configRepo: {
        findOne: async () => ({
          configKey: 'SYSTEM_WAKATIME_CONFIG',
          configValue: JSON.stringify({
            apiKey: 'old-secret',
            timeZone: 'UTC',
            enabled: true,
          }),
          description: '',
          extra: {},
        }),
        save: async () => {
          throw new Error(`driver echoed ${apiKey}`);
        },
      },
    });
    await assert.rejects(
      () =>
        service.setWakaTimeConfig({ apiKey, timeZone: 'UTC', enabled: true }, {
          role: 0,
        } as never),
      (error: unknown) => !String(error).includes(apiKey),
    );
    assert.equal(
      logs.some((message) => message.includes(apiKey)),
      false,
    );
  });
});
