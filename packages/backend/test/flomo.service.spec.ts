import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { getMetadataArgsStorage } from 'typeorm';
import {
  FlomoConfigEntity,
  FlomoPublicMemoEntity,
  FlomoSyncStateEntity,
} from '../src/entities';
import { FLOMO_NORMALIZER_VERSION } from '../src/module/flomo/flomo-normalizer';
import { FlomoService } from '../src/module/flomo/flomo.service';

function attachLogger(service: FlomoService): void {
  Object.assign(service, {
    logger: { log: () => undefined, warn: () => undefined },
  });
}

describe('FlomoService configuration and public revision gate', () => {
  it('encrypts/masks token, retains identical saves and hides rows after policy revision', async () => {
    let config: Record<string, unknown> | null = null;
    const state = {
      id: 1,
      appliedSourceRevision: 1,
      normalizerVersion: FLOMO_NORMALIZER_VERSION,
      status: 'healthy',
      lastAttemptedAt: null,
      lastSuccessfulAt: new Date('2026-08-20T02:00:00.000Z'),
      publicMemoCount: 1,
      errorCategory: null,
    };
    const configRepo = {
      findOneBy: async () => config,
      findOne: async () => config,
      create: (value: Record<string, unknown>) => ({ ...value }),
      save: async (value: Record<string, unknown>) => {
        config = value;
        return value;
      },
    };
    let memoReads = 0;
    const service = new FlomoService(
      configRepo as never,
      {
        createQueryBuilder: () => {
          memoReads += 1;
          throw new Error('revision-mismatched rows must not be queried');
        },
      } as never,
      { findOneBy: async () => state } as never,
      {
        transaction: async (callback: (manager: object) => unknown) =>
          callback({
            getRepository: (entity: unknown) =>
              entity === FlomoConfigEntity
                ? configRepo
                : entity === FlomoSyncStateEntity
                  ? { findOneBy: async () => state }
                  : {
                      createQueryBuilder: () => {
                        memoReads += 1;
                        throw new Error(
                          'revision-mismatched rows must not be queried',
                        );
                      },
                    },
          }),
      } as never,
      {
        encrypt: (plaintext: Buffer) => ({
          ciphertext: Buffer.from(plaintext),
          nonce: Buffer.alloc(12, 1),
          authTag: Buffer.alloc(16, 2),
          envelopeVersion: 2,
          keyVersion: 1,
        }),
        decrypt: (envelope: { ciphertext: Buffer }) =>
          Buffer.from(envelope.ciphertext),
      } as never,
      {} as never,
    );
    attachLogger(service);
    Object.assign(service, {
      triggerSync: () => ({ accepted: true, alreadyRunning: false }),
    });

    const first = await service.setConfig({
      enabled: true,
      token: 'Bearer secret',
      publicationTags: [' #公开 ', '公开'],
    });
    assert.equal(first.token, '********');
    assert.deepEqual(first.publicationTags, ['公开']);
    assert.equal(config?.sourceRevision, 1);
    assert.notEqual(
      (config as Record<string, unknown>).tokenCiphertext,
      'secret',
    );

    await service.setConfig({
      enabled: true,
      token: 'Bearer secret',
      publicationTags: ['公开'],
    });
    assert.equal(config?.sourceRevision, 1);

    await service.setConfig({
      enabled: true,
      token: '',
      publicationTags: ['另一标签'],
    });
    assert.equal(config?.sourceRevision, 2);
    assert.deepEqual(await service.getPublicNotes(), {
      items: [],
      nextCursor: null,
    });
    assert.equal(memoReads, 0);
  });

  it('rejects enabling without both a stored token and publication tag', async () => {
    const repo = {
      findOneBy: async () => null,
      findOne: async () => null,
      create: (value: Record<string, unknown>) => ({ ...value }),
      save: async (value: Record<string, unknown>) => value,
    };
    const service = new FlomoService(
      repo as never,
      {} as never,
      { findOneBy: async () => null } as never,
      {
        transaction: async (callback: (manager: object) => unknown) =>
          callback({ getRepository: () => repo }),
      } as never,
      {} as never,
      {} as never,
    );
    attachLogger(service);
    await assert.rejects(
      service.setConfig({ enabled: true, token: '', publicationTags: [] }),
      /启用 Flomo/u,
    );
  });
});

describe('FlomoService public cursor allowlist', () => {
  it('uses nullable JSON without a MySQL-incompatible column default', () => {
    const displayTags = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === FlomoPublicMemoEntity &&
        column.propertyName === 'displayTags',
    );
    assert.equal(displayTags?.options.type, 'json');
    assert.equal(displayTags?.options.nullable, true);
    assert.equal(displayTags && 'default' in displayTags.options, false);
  });

  it('fails closed until rows use the current normalizer contract', async () => {
    let memoReads = 0;
    const configRepo = {
      findOneBy: async () => ({ enabled: true, sourceRevision: 4 }),
    };
    const stateRepo = {
      findOneBy: async () => ({
        appliedSourceRevision: 4,
        normalizerVersion: FLOMO_NORMALIZER_VERSION - 1,
      }),
    };
    const memoRepo = {
      createQueryBuilder: () => {
        memoReads += 1;
        throw new Error('stale normalized rows must not be queried');
      },
    };
    const service = new FlomoService(
      configRepo as never,
      memoRepo as never,
      stateRepo as never,
      {
        transaction: async (callback: (manager: object) => unknown) =>
          callback({
            getRepository: (entity: unknown) =>
              entity === FlomoConfigEntity
                ? configRepo
                : entity === FlomoSyncStateEntity
                  ? stateRepo
                  : memoRepo,
          }),
      } as never,
      {} as never,
      {} as never,
    );
    attachLogger(service);

    assert.deepEqual(await service.getPublicNotes(), {
      items: [],
      nextCursor: null,
    });
    assert.equal(memoReads, 0);
  });

  it('returns a 20-row lookahead page and serializes only the shared public fields', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: String(100 - index),
      publicId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      sourceSlug: `private-${index}`,
      contentHtml: `<p>memo-${index}</p>`,
      previewText: `memo-${index}`,
      displayTags: index === 0 ? ['随想'] : index === 1 ? null : [],
      sourceCreatedAt: new Date(
        `2026-08-${String(21 - index).padStart(2, '0')}T02:00:00.000Z`,
      ),
      sourceUpdatedAt: new Date('2026-08-21T02:00:00.000Z'),
      contentHash: 'private-hash',
    }));
    const query = {
      orderBy: () => query,
      addOrderBy: () => query,
      take: (value: number) => {
        assert.equal(value, 21);
        return query;
      },
      getMany: async () => rows,
    };
    const configRepo = {
      findOneBy: async () => ({ enabled: true, sourceRevision: 4 }),
    };
    const stateRepo = {
      findOneBy: async () => ({
        appliedSourceRevision: 4,
        normalizerVersion: FLOMO_NORMALIZER_VERSION,
      }),
    };
    const memoRepo = {
      createQueryBuilder: () => query,
    };
    const service = new FlomoService(
      configRepo as never,
      memoRepo as never,
      stateRepo as never,
      {
        transaction: async (callback: (manager: object) => unknown) =>
          callback({
            getRepository: (entity: unknown) =>
              entity === FlomoConfigEntity
                ? configRepo
                : entity === FlomoSyncStateEntity
                  ? stateRepo
                  : entity === FlomoPublicMemoEntity
                    ? memoRepo
                    : undefined,
          }),
      } as never,
      {} as never,
      {} as never,
    );
    attachLogger(service);
    const page = await service.getPublicNotes();
    assert.equal(page.items.length, 20);
    assert.equal(page.nextCursor, rows[19]?.publicId);
    assert.deepEqual(Object.keys(page.items[0] ?? {}).sort(), [
      'contentHtml',
      'createdAt',
      'displayTags',
      'id',
      'previewText',
      'updatedAt',
    ]);
    const json = JSON.stringify(page);
    assert.deepEqual(page.items[0]?.displayTags, ['随想']);
    assert.deepEqual(page.items[1]?.displayTags, []);
    for (const forbidden of [
      'private-',
      'sourceSlug',
      'contentHash',
      'publicationTags',
      'attachment',
    ]) {
      assert.equal(json.includes(forbidden), false);
    }
  });

  it('reads the revision gate, cursor boundary and page from one transaction manager', async () => {
    const calls: string[] = [];
    const query = {
      orderBy: () => query,
      addOrderBy: () => query,
      take: () => query,
      andWhere: () => {
        calls.push('boundary-applied');
        return query;
      },
      getMany: async () => [],
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === FlomoConfigEntity) {
          return {
            findOneBy: async () => {
              calls.push('config');
              return { enabled: true, sourceRevision: 2 };
            },
          };
        }
        if (entity === FlomoSyncStateEntity) {
          return {
            findOneBy: async () => {
              calls.push('state');
              return {
                appliedSourceRevision: 2,
                normalizerVersion: FLOMO_NORMALIZER_VERSION,
              };
            },
          };
        }
        return {
          createQueryBuilder: () => query,
          findOneBy: async () => ({
            id: '10',
            sourceCreatedAt: new Date('2026-08-20T02:00:00.000Z'),
          }),
        };
      },
    };
    let transactions = 0;
    const service = new FlomoService(
      { findOneBy: () => assert.fail('global config repo read') } as never,
      {
        createQueryBuilder: () => assert.fail('global memo repo read'),
      } as never,
      { findOneBy: () => assert.fail('global state repo read') } as never,
      {
        transaction: async (callback: (value: object) => unknown) => {
          transactions += 1;
          return callback(manager);
        },
      } as never,
      {} as never,
      {} as never,
    );
    attachLogger(service);

    assert.deepEqual(
      await service.getPublicNotes('00000000-0000-4000-8000-000000000001'),
      { items: [], nextCursor: null },
    );
    assert.equal(transactions, 1);
    assert.ok(calls.includes('config'));
    assert.ok(calls.includes('state'));
    assert.ok(calls.includes('boundary-applied'));
  });
});

describe('FlomoService trigger coordination', () => {
  it('coalesces concurrent triggers and queues one follow-up run', async () => {
    const service = new FlomoService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    attachLogger(service);
    const resolvers: Array<() => void> = [];
    let runs = 0;
    Object.assign(service, {
      runSync: async () => {
        runs += 1;
        await new Promise<void>((resolve) => resolvers.push(resolve));
      },
    });

    assert.deepEqual(service.triggerSync(), {
      accepted: true,
      alreadyRunning: false,
    });
    assert.deepEqual(service.triggerSync(), {
      accepted: false,
      alreadyRunning: true,
    });
    assert.equal(runs, 1);
    resolvers.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(runs, 2);
    resolvers.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('does not normalize another instance active sync when the advisory lock is busy', async () => {
    let stateReads = 0;
    let releases = 0;
    const service = new FlomoService(
      {} as never,
      {} as never,
      {
        findOneBy: async () => {
          stateReads += 1;
          return { status: 'syncing' };
        },
      } as never,
      {
        createQueryRunner: () => ({
          connect: async () => undefined,
          query: async () => [{ acquired: 0 }],
          release: async () => {
            releases += 1;
          },
        }),
      } as never,
      {} as never,
      {} as never,
    );
    attachLogger(service);

    await (
      service as unknown as { normalizeStaleState(): Promise<void> }
    ).normalizeStaleState();
    assert.equal(stateReads, 0);
    assert.equal(releases, 1);
  });

  it('uses one-day lookback and a non-regressing same-time slug checkpoint', () => {
    const service = new FlomoService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const internals = service as unknown as {
      buildInitialCursor(
        state: { latestUpdatedAt: Date },
        isFull: boolean,
      ): { updatedAt: Date | null; slug: string };
      nonRegressingCursor(
        fetched: { updatedAt: Date | null; slug: string },
        state: { latestUpdatedAt: Date; latestSlug: string },
        isFull: boolean,
      ): { updatedAt: Date | null; slug: string };
    };
    const checkpoint = new Date('2026-08-20T02:00:00.000Z');
    assert.equal(
      internals
        .buildInitialCursor({ latestUpdatedAt: checkpoint }, false)
        .updatedAt?.toISOString(),
      '2026-08-19T02:00:00.000Z',
    );
    assert.deepEqual(
      internals.buildInitialCursor({ latestUpdatedAt: checkpoint }, true),
      { updatedAt: null, slug: '' },
    );
    assert.deepEqual(
      internals.nonRegressingCursor(
        { updatedAt: checkpoint, slug: 'slug-a' },
        { latestUpdatedAt: checkpoint, latestSlug: 'slug-b' },
        false,
      ),
      { updatedAt: checkpoint, slug: 'slug-b' },
    );
    assert.deepEqual(
      internals.nonRegressingCursor(
        { updatedAt: checkpoint, slug: 'slug-c' },
        { latestUpdatedAt: checkpoint, latestSlug: 'slug-b' },
        false,
      ),
      { updatedAt: checkpoint, slug: 'slug-c' },
    );
  });
});

describe('FlomoService transactional sync commit', () => {
  it('stamps a successful snapshot with the current normalizer version', async () => {
    const state = { id: 1, normalizerVersion: null };
    const configRepo = {
      findOne: async () => ({ enabled: true, sourceRevision: 3 }),
    };
    const memoRepo = { count: async () => 0 };
    const stateRepo = {
      findOne: async () => state,
      create: (value: Record<string, unknown>) => value,
      save: async (value: Record<string, unknown>) => value,
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === FlomoConfigEntity
          ? configRepo
          : entity === FlomoPublicMemoEntity
            ? memoRepo
            : stateRepo,
    };
    const service = new FlomoService(
      {} as never,
      {} as never,
      {} as never,
      {
        transaction: async (callback: (value: object) => unknown) =>
          callback(manager),
      } as never,
      {} as never,
      {} as never,
    );
    const commit = (
      service as unknown as {
        commitSync(
          revision: number,
          isFull: boolean,
          actions: unknown[],
          cursor: { updatedAt: Date; slug: string },
        ): Promise<void>;
      }
    ).commitSync.bind(service);

    await commit(3, false, [], {
      updatedAt: new Date('2026-08-20T02:00:00.000Z'),
      slug: 'memo-1',
    });
    assert.equal(state.normalizerVersion, FLOMO_NORMALIZER_VERSION);
  });

  it('does not advance state when a row write fails inside the transaction', async () => {
    let stateSaved = false;
    const configRepo = {
      findOne: async () => ({ enabled: true, sourceRevision: 3 }),
    };
    const memoRepo = {
      findOneBy: async () => null,
      create: (value: Record<string, unknown>) => value,
      save: async () => {
        throw new Error('simulated row failure');
      },
      count: async () => 0,
    };
    const stateRepo = {
      findOne: async () => ({ id: 1, latestSlug: 'old' }),
      create: (value: Record<string, unknown>) => value,
      save: async () => {
        stateSaved = true;
      },
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === FlomoConfigEntity
          ? configRepo
          : entity === FlomoPublicMemoEntity
            ? memoRepo
            : stateRepo,
    };
    const service = new FlomoService(
      {} as never,
      {} as never,
      {} as never,
      {
        transaction: async (callback: (value: object) => unknown) =>
          callback(manager),
      } as never,
      {} as never,
      {} as never,
    );
    const commit = (
      service as unknown as {
        commitSync(
          revision: number,
          isFull: boolean,
          actions: unknown[],
          cursor: { updatedAt: Date; slug: string },
        ): Promise<void>;
      }
    ).commitSync.bind(service);

    await assert.rejects(
      commit(
        3,
        false,
        [
          {
            type: 'upsert',
            memo: {
              sourceSlug: 'memo-1',
              contentHtml: '<p>safe</p>',
              previewText: 'safe',
              displayTags: [],
              sourceCreatedAt: new Date('2026-08-20T01:00:00.000Z'),
              sourceUpdatedAt: new Date('2026-08-20T02:00:00.000Z'),
              contentHash: 'hash',
            },
          },
        ],
        {
          updatedAt: new Date('2026-08-20T02:00:00.000Z'),
          slug: 'memo-1',
        },
      ),
      /simulated row failure/u,
    );
    assert.equal(stateSaved, false);
  });
});
