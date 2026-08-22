import { randomUUID, timingSafeEqual } from 'crypto';
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FLOMO_PUBLIC_PAGE_SIZE,
  FLOMO_TOKEN_MASK,
  normalizeFlomoPublicationTags,
  normalizeFlomoToken,
  shouldKeepExistingFlomoToken,
  type IFlomoAdminConfig,
  type IFlomoAdminStatus,
  type IFlomoConfig,
  type IFlomoPublicMemo,
  type IFlomoPublicMemoPage,
  type IFlomoSyncTriggerResult,
} from '@applog/common';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { DataSource, Repository, type EntityManager } from 'typeorm';
import {
  FlomoConfigEntity,
  FlomoPublicMemoEntity,
  FlomoSyncStateEntity,
} from '@/entities';
import { SecretEncryptionService } from '@/module/secret-encryption/secret-encryption.service';
import {
  FLOMO_NORMALIZER_VERSION,
  normalizeFlomoMemo,
  type FlomoNormalizedAction,
} from './flomo-normalizer';
import {
  FLOMO_SOURCE_ADAPTER,
  FlomoSourceError,
  type FlomoSourceAdapter,
  type IFlomoSourceCursor,
} from './flomo-source.types';

const FLOMO_CONFIG_ID = 1;
const FLOMO_TOKEN_RECORD_IDENTITY = '1';
const FLOMO_SYNC_LOCK = 'applog:flomo:sync';
const FLOMO_SYNC_INTERVAL_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class FlomoConfigSupersededError extends Error {}

@Injectable()
export class FlomoService implements OnModuleInit, OnModuleDestroy {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private syncPromise: Promise<void> | undefined;
  private syncRequested = false;
  private syncTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @InjectRepository(FlomoConfigEntity)
    private readonly configRepository: Repository<FlomoConfigEntity>,
    @InjectRepository(FlomoPublicMemoEntity)
    private readonly memoRepository: Repository<FlomoPublicMemoEntity>,
    @InjectRepository(FlomoSyncStateEntity)
    private readonly stateRepository: Repository<FlomoSyncStateEntity>,
    private readonly dataSource: DataSource,
    private readonly encryption: SecretEncryptionService,
    @Inject(FLOMO_SOURCE_ADAPTER)
    private readonly sourceAdapter: FlomoSourceAdapter,
  ) {}

  onModuleInit(): void {
    void this.recoverAndStartSync();
    this.syncTimer = setInterval(
      () => void this.triggerSync(),
      FLOMO_SYNC_INTERVAL_MS,
    );
    this.syncTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = undefined;
  }

  /**
   * Normalize interrupted persisted state, then start the first background sync.
   */
  private async recoverAndStartSync(): Promise<void> {
    try {
      await this.normalizeStaleState();
      this.triggerSync();
    } catch {
      this.logger.warn(
        'Flomo 启动状态恢复失败: kind=database',
        FlomoService.name,
      );
    }
  }

  /**
   * Await a sync promise and always clear the in-process single-flight slot.
   * @param promise - The in-flight run
   * @param finish - Clears the slot and optionally starts a queued follow-up
   */
  private async settleSync(
    promise: Promise<void>,
    finish: () => void,
  ): Promise<void> {
    try {
      await promise;
    } catch (error: unknown) {
      this.logger.warn(
        `Flomo 同步任务异常结束: kind=${error instanceof Error ? error.name : 'unknown'}`,
        FlomoService.name,
      );
    } finally {
      finish();
    }
  }

  /**
   * Return the masked admin configuration plus credential-free sync status.
   * @returns Admin config with token replaced by the shared mask when stored
   */
  async getConfig(): Promise<IFlomoAdminConfig> {
    const [config, sync] = await Promise.all([
      this.configRepository.findOneBy({ id: FLOMO_CONFIG_ID }),
      this.getStatus(),
    ]);
    return {
      token: config?.tokenCiphertext ? FLOMO_TOKEN_MASK : '',
      publicationTags: config?.publicationTags ?? [],
      enabled: config?.enabled ?? false,
      sync,
    };
  }

  /**
   * Return credential-free sync health for admin polling.
   * @returns Normalized status, timestamps, count, and error category
   */
  async getStatus(): Promise<IFlomoAdminStatus> {
    const state = await this.stateRepository.findOneBy({ id: FLOMO_CONFIG_ID });
    return this.mapStatus(state);
  }

  /**
   * Persist publication policy and encrypt a new token when one is submitted.
   * @param input - Enabled flag, optional token, and exact publication tags
   * @returns The saved masked admin configuration
   * @throws {BusinessException} When enabled without a token/tag, or tags are invalid
   */
  async setConfig(input: IFlomoConfig): Promise<IFlomoAdminConfig> {
    let tags: string[];
    try {
      tags = normalizeFlomoPublicationTags(input.publicationTags);
    } catch {
      throw new BusinessException('发布标签格式无效');
    }
    const keepToken = shouldKeepExistingFlomoToken(input.token);
    const normalizedToken = keepToken ? '' : normalizeFlomoToken(input.token);

    let sourceChanged = false;
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FlomoConfigEntity);
      let entity = await repo.findOne({
        where: { id: FLOMO_CONFIG_ID },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) {
        entity = repo.create({
          id: FLOMO_CONFIG_ID,
          enabled: false,
          publicationTags: [],
          sourceRevision: 0,
          tokenCiphertext: null,
          tokenNonce: null,
          tokenAuthTag: null,
          tokenEnvelopeVersion: null,
          tokenKeyVersion: null,
        });
      }

      const hadToken = Boolean(entity.tokenCiphertext);
      let tokenChanged = false;
      if (!keepToken) {
        tokenChanged = !(await this.tokenEquals(entity, normalizedToken));
        if (tokenChanged) this.assignEncryptedToken(entity, normalizedToken);
      }
      const tagsChanged =
        JSON.stringify([...(entity.publicationTags ?? [])].sort()) !==
        JSON.stringify([...tags].sort());
      const hasToken = keepToken ? hadToken : Boolean(normalizedToken);
      if (input.enabled && (!hasToken || tags.length === 0)) {
        throw new BusinessException(
          '启用 Flomo 前请保存 token 并配置至少一个发布标签',
        );
      }

      sourceChanged = tokenChanged || tagsChanged;
      entity.enabled = input.enabled === true;
      entity.publicationTags = tags;
      if (sourceChanged) entity.sourceRevision += 1;
      await repo.save(entity);
    });

    if (input.enabled) void this.triggerSync();
    return this.getConfig();
  }

  /**
   * Request a background sync without overlapping in-process runs.
   * @returns Whether this call started a new run or joined one already in flight
   */
  triggerSync(): IFlomoSyncTriggerResult {
    if (this.syncPromise) {
      this.syncRequested = true;
      return { accepted: false, alreadyRunning: true };
    }
    const promise = this.runSync();
    this.syncPromise = promise;
    const finish = (): void => {
      if (this.syncPromise === promise) {
        this.syncPromise = undefined;
        if (this.syncRequested) {
          this.syncRequested = false;
          this.triggerSync();
        }
      }
    };
    void this.settleSync(promise, finish);
    return { accepted: true, alreadyRunning: false };
  }

  /**
   * Read one public page from the persisted snapshot. Never calls Flomo.
   * @param cursor - Optional public-id keyset boundary
   * @returns Up to 20 allowlisted memos and the next cursor
   * @throws {BusinessException} When the cursor does not match a current public row
   */
  async getPublicNotes(cursor?: string): Promise<IFlomoPublicMemoPage> {
    return this.dataSource.transaction(async (manager) => {
      const configRepo = manager.getRepository(FlomoConfigEntity);
      const stateRepo = manager.getRepository(FlomoSyncStateEntity);
      const memoRepo = manager.getRepository(FlomoPublicMemoEntity);
      const [config, state] = await Promise.all([
        configRepo.findOneBy({ id: FLOMO_CONFIG_ID }),
        stateRepo.findOneBy({ id: FLOMO_CONFIG_ID }),
      ]);
      if (
        !config?.enabled ||
        state?.appliedSourceRevision === null ||
        state?.appliedSourceRevision === undefined ||
        state.appliedSourceRevision !== config.sourceRevision ||
        state.normalizerVersion !== FLOMO_NORMALIZER_VERSION
      ) {
        return { items: [], nextCursor: null };
      }

      const query = memoRepo
        .createQueryBuilder('memo')
        .orderBy('memo.sourceCreatedAt', 'DESC')
        .addOrderBy('memo.id', 'DESC')
        .take(FLOMO_PUBLIC_PAGE_SIZE + 1);
      if (cursor) {
        const boundary = await memoRepo.findOneBy({ publicId: cursor });
        if (!boundary) throw new BusinessException('笔记游标无效或已过期');
        query.andWhere(
          '(memo.sourceCreatedAt < :createdAt OR (memo.sourceCreatedAt = :createdAt AND memo.id < :id))',
          { createdAt: boundary.sourceCreatedAt, id: boundary.id },
        );
      }
      const rows = await query.getMany();
      const hasMore = rows.length > FLOMO_PUBLIC_PAGE_SIZE;
      const pageRows = rows.slice(0, FLOMO_PUBLIC_PAGE_SIZE);
      return {
        items: pageRows.map((row) => this.mapPublicMemo(row)),
        nextCursor: hasMore ? (pageRows.at(-1)?.publicId ?? null) : null,
      };
    });
  }

  private async normalizeStaleState(): Promise<void> {
    const lockRunner = this.dataSource.createQueryRunner();
    let connected = false;
    let locked = false;
    try {
      await lockRunner.connect();
      connected = true;
      const lockRows = (await lockRunner.query(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [FLOMO_SYNC_LOCK],
      )) as Array<{ acquired: number | string }>;
      locked = Number(lockRows[0]?.acquired) === 1;
      if (!locked) return;

      const state = await this.stateRepository.findOneBy({
        id: FLOMO_CONFIG_ID,
      });
      if (state?.status === 'syncing') {
        state.status = 'degraded';
        state.errorCategory = 'interrupted';
        await this.stateRepository.save(state);
      }
    } finally {
      if (locked) {
        try {
          await lockRunner.query('SELECT RELEASE_LOCK(?)', [FLOMO_SYNC_LOCK]);
        } catch {
          this.logger.warn(
            'Flomo 启动恢复锁释放失败: kind=database',
            FlomoService.name,
          );
        }
      }
      if (connected) await lockRunner.release();
    }
  }

  private async runSync(): Promise<void> {
    const lockRunner = this.dataSource.createQueryRunner();
    let connected = false;
    let locked = false;
    try {
      await lockRunner.connect();
      connected = true;
      const lockRows = (await lockRunner.query(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [FLOMO_SYNC_LOCK],
      )) as Array<{ acquired: number | string }>;
      locked = Number(lockRows[0]?.acquired) === 1;
      if (!locked) return;

      const config = await this.configRepository.findOneBy({
        id: FLOMO_CONFIG_ID,
      });
      if (
        !config?.enabled ||
        !config.tokenCiphertext ||
        !config.publicationTags.length
      )
        return;
      const state = await this.getOrCreateState();
      const sourceRevision = config.sourceRevision;
      const isFull =
        state.appliedSourceRevision !== sourceRevision ||
        state.normalizerVersion !== FLOMO_NORMALIZER_VERSION ||
        !state.lastSuccessfulAt;
      state.status = 'syncing';
      state.errorCategory = null;
      state.lastAttemptedAt = new Date();
      await this.stateRepository.save(state);

      const tokenBuffer = this.decryptToken(config);
      let token = '';
      try {
        token = tokenBuffer.toString('utf8');
        const initialCursor = this.buildInitialCursor(state, isFull);
        const result = await this.sourceAdapter.fetchChanges(
          token,
          initialCursor,
        );
        const actions = result.memos.map((memo) =>
          normalizeFlomoMemo(memo, config.publicationTags),
        );
        const cursor = this.nonRegressingCursor(result.cursor, state, isFull);
        await this.commitSync(sourceRevision, isFull, actions, cursor);
        this.logger.log(
          `Flomo 同步成功: mode=${isFull ? 'full' : 'incremental'}, received=${result.memos.length}`,
          FlomoService.name,
        );
      } finally {
        token = '';
        tokenBuffer.fill(0);
      }
    } catch (error) {
      if (error instanceof FlomoConfigSupersededError) {
        await this.recordSuperseded();
      } else {
        await this.recordFailure(error);
      }
    } finally {
      if (locked) {
        try {
          await lockRunner.query('SELECT RELEASE_LOCK(?)', [FLOMO_SYNC_LOCK]);
        } catch {
          this.logger.warn(
            'Flomo 同步锁释放失败: kind=database',
            FlomoService.name,
          );
        }
      }
      if (connected) await lockRunner.release();
    }
  }

  private async commitSync(
    sourceRevision: number,
    isFull: boolean,
    actions: FlomoNormalizedAction[],
    cursor: IFlomoSourceCursor,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const config = await manager.getRepository(FlomoConfigEntity).findOne({
        where: { id: FLOMO_CONFIG_ID },
        lock: { mode: 'pessimistic_write' },
      });
      if (!config?.enabled || config.sourceRevision !== sourceRevision) {
        throw new FlomoConfigSupersededError();
      }
      const memoRepo = manager.getRepository(FlomoPublicMemoEntity);
      const finalActions = new Map<string, FlomoNormalizedAction>();
      for (const action of actions) {
        finalActions.set(
          action.type === 'upsert' ? action.memo.sourceSlug : action.sourceSlug,
          action,
        );
      }
      if (isFull) await memoRepo.createQueryBuilder().delete().execute();
      for (const action of finalActions.values()) {
        if (action.type === 'delete') {
          if (!isFull) await memoRepo.delete({ sourceSlug: action.sourceSlug });
          continue;
        }
        await this.upsertMemo(manager, action.memo);
      }

      const stateRepo = manager.getRepository(FlomoSyncStateEntity);
      const state =
        (await stateRepo.findOne({
          where: { id: FLOMO_CONFIG_ID },
          lock: { mode: 'pessimistic_write' },
        })) ?? stateRepo.create({ id: FLOMO_CONFIG_ID });
      state.appliedSourceRevision = sourceRevision;
      state.normalizerVersion = FLOMO_NORMALIZER_VERSION;
      state.latestUpdatedAt = cursor.updatedAt;
      state.latestSlug = cursor.slug || null;
      state.lastSuccessfulAt = new Date();
      state.status = 'healthy';
      state.errorCategory = null;
      state.publicMemoCount = await memoRepo.count();
      await stateRepo.save(state);
    });
  }

  private async upsertMemo(
    manager: EntityManager,
    memo: Extract<FlomoNormalizedAction, { type: 'upsert' }>['memo'],
  ): Promise<void> {
    const repo = manager.getRepository(FlomoPublicMemoEntity);
    const existing = await repo.findOneBy({ sourceSlug: memo.sourceSlug });
    if (existing?.contentHash === memo.contentHash) return;
    await repo.save(
      repo.create({
        ...existing,
        ...memo,
        publicId: existing?.publicId ?? randomUUID(),
      }),
    );
  }

  private async recordFailure(error: unknown): Promise<void> {
    const category =
      error instanceof FlomoSourceError ? error.category : 'internal';
    const state = await this.getOrCreateState();
    state.status = category === 'unauthorized' ? 'reauth_required' : 'degraded';
    state.errorCategory = category;
    await this.stateRepository.save(state);
    this.logger.warn(`Flomo 同步失败: kind=${category}`, FlomoService.name);
  }

  private async recordSuperseded(): Promise<void> {
    const state = await this.getOrCreateState();
    if (state.status !== 'syncing') return;
    state.status = 'degraded';
    state.errorCategory = 'configuration_changed';
    await this.stateRepository.save(state);
  }

  private async getOrCreateState(): Promise<FlomoSyncStateEntity> {
    return (
      (await this.stateRepository.findOneBy({ id: FLOMO_CONFIG_ID })) ??
      this.stateRepository.create({
        id: FLOMO_CONFIG_ID,
        appliedSourceRevision: null,
        normalizerVersion: null,
        latestUpdatedAt: null,
        latestSlug: null,
        lastAttemptedAt: null,
        lastSuccessfulAt: null,
        status: 'never_synced',
        errorCategory: null,
        publicMemoCount: 0,
      })
    );
  }

  private buildInitialCursor(
    state: FlomoSyncStateEntity,
    isFull: boolean,
  ): IFlomoSourceCursor {
    if (isFull || !state.latestUpdatedAt) return { updatedAt: null, slug: '' };
    return {
      updatedAt: new Date(state.latestUpdatedAt.getTime() - ONE_DAY_MS),
      slug: '',
    };
  }

  private nonRegressingCursor(
    fetched: IFlomoSourceCursor,
    state: FlomoSyncStateEntity,
    isFull: boolean,
  ): IFlomoSourceCursor {
    if (isFull || !state.latestUpdatedAt) return fetched;
    const saved = {
      updatedAt: state.latestUpdatedAt,
      slug: state.latestSlug ?? '',
    };
    const fetchedTime = fetched.updatedAt?.getTime() ?? -1;
    const savedTime = saved.updatedAt.getTime();
    return fetchedTime > savedTime ||
      (fetchedTime === savedTime && fetched.slug > saved.slug)
      ? fetched
      : saved;
  }

  private decryptToken(config: FlomoConfigEntity): Buffer {
    if (
      !config.tokenCiphertext ||
      !config.tokenNonce ||
      !config.tokenAuthTag ||
      config.tokenEnvelopeVersion !== 2 ||
      config.tokenKeyVersion !== 1
    ) {
      throw new Error('invalid Flomo token envelope');
    }
    return this.encryption.decrypt(
      {
        ciphertext: config.tokenCiphertext,
        nonce: config.tokenNonce,
        authTag: config.tokenAuthTag,
        envelopeVersion: 2,
        keyVersion: 1,
      },
      'flomo.token',
      FLOMO_TOKEN_RECORD_IDENTITY,
    );
  }

  private assignEncryptedToken(config: FlomoConfigEntity, token: string): void {
    if (!token) {
      config.tokenCiphertext = null;
      config.tokenNonce = null;
      config.tokenAuthTag = null;
      config.tokenEnvelopeVersion = null;
      config.tokenKeyVersion = null;
      return;
    }
    const plaintext = Buffer.from(token, 'utf8');
    try {
      const envelope = this.encryption.encrypt(
        plaintext,
        'flomo.token',
        FLOMO_TOKEN_RECORD_IDENTITY,
      );
      config.tokenCiphertext = envelope.ciphertext;
      config.tokenNonce = envelope.nonce;
      config.tokenAuthTag = envelope.authTag;
      config.tokenEnvelopeVersion = envelope.envelopeVersion;
      config.tokenKeyVersion = envelope.keyVersion;
    } finally {
      plaintext.fill(0);
    }
  }

  private async tokenEquals(
    config: FlomoConfigEntity,
    token: string,
  ): Promise<boolean> {
    if (!config.tokenCiphertext) return token === '';
    let current: Buffer | undefined;
    const candidate = Buffer.from(token, 'utf8');
    try {
      current = this.decryptToken(config);
      return (
        current.length === candidate.length &&
        timingSafeEqual(current, candidate)
      );
    } finally {
      current?.fill(0);
      candidate.fill(0);
    }
  }

  private mapStatus(state: FlomoSyncStateEntity | null): IFlomoAdminStatus {
    return {
      status: state?.status ?? 'never_synced',
      lastAttemptedAt: state?.lastAttemptedAt?.toISOString() ?? null,
      lastSuccessfulAt: state?.lastSuccessfulAt?.toISOString() ?? null,
      publicMemoCount: state?.publicMemoCount ?? 0,
      errorCategory: state?.errorCategory ?? null,
    };
  }

  private mapPublicMemo(row: FlomoPublicMemoEntity): IFlomoPublicMemo {
    return {
      id: row.publicId,
      previewText: row.previewText,
      contentHtml: row.contentHtml,
      displayTags: row.displayTags ?? [],
      createdAt: row.sourceCreatedAt.toISOString(),
      updatedAt: row.sourceUpdatedAt.toISOString(),
    };
  }
}
