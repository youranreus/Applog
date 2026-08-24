import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { GALLERY_SECRET_MASK } from '@applog/common';
import { GalleryService } from '../src/module/gallery/gallery.service';

function createHarness() {
  let config: Record<string, any> | null = null;
  const calls: string[] = [];
  let headHook: (() => Promise<void>) | undefined;
  let putHook: (() => Promise<void>) | undefined;
  const configRepo = {
    findOneBy: async () => (config ? { ...config } : null),
    create: (value: Record<string, unknown>) => ({ ...value }),
    save: async (value: Record<string, any>) => {
      config = { ...value };
      return { ...config };
    },
    update: async (
      criteria: Record<string, unknown>,
      value: Record<string, unknown>,
    ) => {
      if (
        !config ||
        Object.entries(criteria).some(
          ([key, expected]) => config?.[key] !== expected,
        )
      )
        return { affected: 0 };
      Object.assign(config, value);
      return { affected: 1 };
    },
  };
  const photoRepo = { findOneBy: async () => null };
  const service = new GalleryService(
    configRepo as never,
    {} as never,
    photoRepo as never,
    {
      encrypt: (value: string) => ({
        ciphertext: Buffer.from(value),
        nonce: Buffer.alloc(12),
        authTag: Buffer.alloc(16),
        envelopeVersion: 2,
        keyVersion: 1,
      }),
      decrypt: (value: { ciphertext: Buffer }) => value.ciphertext,
    } as never,
    {} as never,
    {
      list: async () => {
        calls.push('list');
      },
      put: async () => {
        calls.push('put');
        await putHook?.();
      },
      putFile: async () => undefined,
      headCdn: async () => {
        calls.push('head');
        await headHook?.();
      },
      delete: async () => {
        calls.push('delete');
      },
    } as never,
  );
  Object.assign(service, { logger: { warn: () => undefined } });
  return {
    service,
    calls,
    getConfig: () => config,
    setHeadHook: (value: (() => Promise<void>) | undefined) => {
      headHook = value;
    },
    setPutHook: (value: (() => Promise<void>) | undefined) => {
      putHook = value;
    },
  };
}

describe('GalleryService configuration gate', () => {
  it('masks credentials, verifies the current revision and only then enables', async () => {
    const harness = createHarness();
    const values = {
      endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
      bucket: 'photos',
      accessKeyId: 'key-id',
      accessKeySecret: 'private-secret',
      cdnDomain: 'cdn.example.com',
      galleryPath: '/gallery/',
      enabled: false,
    };
    const saved = await harness.service.setConfig(values);
    assert.equal(saved.accessKeySecret, GALLERY_SECRET_MASK);
    assert.equal(saved.enabled, false);
    assert.equal(saved.verified, false);
    assert.deepEqual(await harness.service.getStatus(), { enabled: false });
    await assert.rejects(
      harness.service.setConfig({
        ...values,
        accessKeySecret: GALLERY_SECRET_MASK,
        enabled: true,
      }),
      /连接测试/u,
    );
    const verified = await harness.service.testConfig();
    assert.equal(verified.verified, true);
    assert.deepEqual(harness.calls, [
      'list',
      'delete',
      'put',
      'head',
      'delete',
    ]);
    const enabled = await harness.service.setConfig({
      ...values,
      accessKeySecret: GALLERY_SECRET_MASK,
      enabled: true,
    });
    assert.equal(enabled.enabled, true);
    assert.deepEqual(await harness.service.getStatus(), { enabled: true });
  });

  it('invalidates verification and disables after a relevant value changes', async () => {
    const harness = createHarness();
    const values = {
      endpoint: 'oss-cn-hangzhou.aliyuncs.com',
      bucket: 'photos',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      cdnDomain: 'cdn.example.com',
      galleryPath: 'gallery',
      enabled: false,
    };
    await harness.service.setConfig(values);
    await harness.service.testConfig();
    await harness.service.setConfig({
      ...values,
      accessKeySecret: GALLERY_SECRET_MASK,
      enabled: true,
    });
    const changed = await harness.service.setConfig({
      ...values,
      accessKeySecret: GALLERY_SECRET_MASK,
      enabled: true,
      galleryPath: 'new-gallery',
    });
    assert.equal(changed.enabled, false);
    assert.equal(changed.verifiedRevision, null);
    assert.equal(harness.getConfig()?.verifiedAt, null);
  });

  it('does not verify a newer revision when configuration changes during a probe', async () => {
    const harness = createHarness();
    const values = {
      endpoint: 'oss-cn-hangzhou.aliyuncs.com',
      bucket: 'photos',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      cdnDomain: 'cdn.example.com',
      galleryPath: 'gallery',
      enabled: false,
    };
    await harness.service.setConfig(values);
    harness.setHeadHook(async () => {
      harness.setHeadHook(undefined);
      await harness.service.setConfig({
        ...values,
        accessKeySecret: GALLERY_SECRET_MASK,
        galleryPath: 'gallery-v2',
      });
    });

    await assert.rejects(harness.service.testConfig(), /配置已变化/u);
    const current = await harness.service.getAdminConfig();
    assert.equal(current.galleryPath, 'gallery-v2');
    assert.equal(current.verified, false);
    assert.equal(current.verifiedRevision, null);
  });

  it('fails public status closed for an inconsistent enabled revision', async () => {
    const harness = createHarness();
    const values = {
      endpoint: 'oss-cn-hangzhou.aliyuncs.com',
      bucket: 'photos',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      cdnDomain: 'cdn.example.com',
      galleryPath: 'gallery',
      enabled: false,
    };
    await harness.service.setConfig(values);
    await harness.service.testConfig();
    await harness.service.setConfig({
      ...values,
      accessKeySecret: GALLERY_SECRET_MASK,
      enabled: true,
    });
    const config = harness.getConfig();
    if (!config) throw new Error('missing config fixture');
    config.verifiedRevision = null;

    assert.deepEqual(await harness.service.getStatus(), { enabled: false });
  });

  it('cleans the deterministic probe after an ambiguous upload failure', async () => {
    const harness = createHarness();
    await harness.service.setConfig({
      endpoint: 'oss-cn-hangzhou.aliyuncs.com',
      bucket: 'photos',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      cdnDomain: 'cdn.example.com',
      galleryPath: 'gallery',
      enabled: false,
    });
    harness.setPutHook(async () => {
      throw new Error('ambiguous timeout');
    });

    await assert.rejects(harness.service.testConfig(), /连接测试失败/u);
    assert.deepEqual(harness.calls, ['list', 'delete', 'put', 'delete']);
  });

  it('treats a repeated delete after the row is gone as success', async () => {
    const harness = createHarness();
    const values = {
      endpoint: 'oss-cn-hangzhou.aliyuncs.com',
      bucket: 'photos',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      cdnDomain: 'cdn.example.com',
      galleryPath: 'gallery',
      enabled: false,
    };
    await harness.service.setConfig(values);
    await harness.service.testConfig();
    await harness.service.setConfig({
      ...values,
      accessKeySecret: GALLERY_SECRET_MASK,
      enabled: true,
    });

    await assert.doesNotReject(harness.service.deletePhoto('already-removed'));
  });
});
