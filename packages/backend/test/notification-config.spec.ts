import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  NOTIFICATION_MAIL_TOKEN_MASK,
  maskNotificationMailToken,
  normalizeNotificationConfig,
  shouldKeepExistingNotificationMailToken,
} from '@applog/common';
import { SystemConfigService } from '../src/module/system-config/system-config.service';

function serviceWithStore(initial?: string) {
  let entity = initial
    ? {
        id: 1,
        configKey: 'SYSTEM_NOTIFICATION_CONFIG',
        configValue: initial,
        getData() {
          return this;
        },
      }
    : undefined;
  const service = new SystemConfigService({
    get: (_key: string, fallback: unknown) => fallback,
  } as never);
  Object.assign(service, {
    logger: { log() {}, warn() {}, error() {} },
    configRepo: {
      findOne: async () => entity,
      create: (value: object) => ({ id: 1, ...value }),
      save: async (value: never) => {
        entity = value;
        return value;
      },
    },
  });
  return { service, stored: () => entity };
}

describe('notification config contract', () => {
  it('normalizes, masks and recognizes preserve values', () => {
    assert.deepEqual(
      normalizeNotificationConfig({ mailToken: ' token ', enabled: true }),
      { mailToken: 'token', enabled: true },
    );
    assert.deepEqual(
      maskNotificationMailToken({ mailToken: 'secret', enabled: true }),
      { mailToken: NOTIFICATION_MAIL_TOKEN_MASK, enabled: true },
    );
    assert.equal(shouldKeepExistingNotificationMailToken(''), true);
    assert.equal(
      shouldKeepExistingNotificationMailToken(NOTIFICATION_MAIL_TOKEN_MASK),
      true,
    );
    assert.equal(shouldKeepExistingNotificationMailToken('replacement'), false);
  });

  it('preserves an existing token on blank save and never returns plaintext', async () => {
    const { service, stored } = serviceWithStore(
      JSON.stringify({ mailToken: 'secret-token', enabled: false }),
    );
    const admin = { id: 1, role: 0 } as never;
    assert.deepEqual(await service.getNotificationConfigMasked(admin), {
      mailToken: NOTIFICATION_MAIL_TOKEN_MASK,
      enabled: false,
    });
    assert.deepEqual(
      await service.setNotificationConfig(
        { mailToken: '', enabled: true },
        admin,
      ),
      { mailToken: NOTIFICATION_MAIL_TOKEN_MASK, enabled: true },
    );
    assert.equal(
      JSON.parse(stored()?.configValue ?? '{}').mailToken,
      'secret-token',
    );
    const generic = await service.getConfig(
      'SYSTEM_NOTIFICATION_CONFIG',
      admin,
    );
    assert.deepEqual(JSON.parse(generic?.configValue ?? '{}'), {
      mailToken: NOTIFICATION_MAIL_TOKEN_MASK,
      enabled: true,
    });
  });

  it('rejects enabling without a stored or submitted token', async () => {
    const { service } = serviceWithStore();
    await assert.rejects(
      service.setNotificationConfig({ mailToken: '', enabled: true }, {
        id: 1,
        role: 0,
      } as never),
      /启用评论邮件通知前/,
    );
  });

  it('blocks generic writes and non-admin reads', async () => {
    const { service } = serviceWithStore(
      JSON.stringify({ mailToken: 'secret-token', enabled: true }),
    );
    await assert.rejects(
      service.getConfig('SYSTEM_NOTIFICATION_CONFIG', {
        id: 2,
        role: 1,
      } as never),
    );
    await assert.rejects(
      service.setConfig(
        {
          configKey: 'SYSTEM_NOTIFICATION_CONFIG',
          configValue: '{}',
        } as never,
        { id: 1, role: 0 } as never,
      ),
      /专用接口/,
    );
  });
});
