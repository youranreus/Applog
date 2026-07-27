import { Inject, Injectable } from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  isDuolingoConfigured,
  type IDuolingoConfig,
  type IDuolingoLandingStats,
} from '@applog/common';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import {
  DUOLINGO_FAILURE_CACHE_TTL_MS,
  DUOLINGO_SUCCESS_CACHE_TTL_MS,
} from './duolingo.constants';
import { DuolingoClient, DuolingoClientError } from './duolingo.client';
import {
  buildDuolingoLandingStats,
  DuolingoPayloadSchemaError,
  getDuolingoSummaryStartDate,
} from './duolingo.utils';

interface IDuolingoCache {
  snapshot: IDuolingoLandingStats | null;
  expiresAt: number;
  failureUntil: number;
}

@Injectable()
export class DuolingoService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private cache: IDuolingoCache = {
    snapshot: null,
    expiresAt: 0,
    failureUntil: 0,
  };
  private generation = 0;
  private inFlight:
    | { generation: number; promise: Promise<IDuolingoLandingStats | null> }
    | undefined;

  constructor(
    private readonly client: DuolingoClient,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  private stale(snapshot: IDuolingoLandingStats): IDuolingoLandingStats {
    return { ...snapshot, stale: true };
  }

  /**
   * 公开统计读取。配置缺失和首次抓取失败均软降级为 null。
   */
  async getLandingStats(): Promise<IDuolingoLandingStats | null> {
    const config = await this.systemConfigService.getDuolingoConfigRaw();
    if (!isDuolingoConfigured(config)) return null;

    const now = Date.now();
    if (this.cache.snapshot && this.cache.expiresAt > now) {
      return { ...this.cache.snapshot, stale: false };
    }
    if (this.cache.snapshot) {
      if (this.cache.failureUntil <= now) {
        void this.refresh(config, this.generation);
      }
      return this.stale(this.cache.snapshot);
    }
    if (this.cache.failureUntil > now) return null;
    return this.refresh(config, this.generation);
  }

  private refresh(
    config: IDuolingoConfig,
    generation: number,
  ): Promise<IDuolingoLandingStats | null> {
    if (this.inFlight && this.inFlight.generation === generation) {
      return this.inFlight.promise;
    }
    const promise = this.load(config, generation);
    this.inFlight = { generation, promise };
    void promise.finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = undefined;
    });
    return promise;
  }

  private async load(
    config: IDuolingoConfig,
    generation: number,
  ): Promise<IDuolingoLandingStats | null> {
    try {
      const raw = await this.client.getLandingData(
        config,
        getDuolingoSummaryStartDate(config.timeZone),
      );
      const snapshot = buildDuolingoLandingStats(
        raw.user,
        raw.summaries,
        config.timeZone,
      );
      if (generation !== this.generation) return null;
      this.cache = {
        snapshot,
        expiresAt: Date.now() + DUOLINGO_SUCCESS_CACHE_TTL_MS,
        failureUntil: 0,
      };
      return snapshot;
    } catch (error) {
      const kind =
        error instanceof DuolingoClientError
          ? error.kind
          : error instanceof DuolingoPayloadSchemaError
            ? 'schema'
            : 'upstream';
      this.logger.warn(
        `Duolingo 统计刷新失败: kind=${kind}`,
        DuolingoService.name,
      );
      if (generation !== this.generation) return null;
      this.cache.failureUntil = Date.now() + DUOLINGO_FAILURE_CACHE_TTL_MS;
      return this.cache.snapshot ? this.stale(this.cache.snapshot) : null;
    }
  }

  /**
   * 管理员读取脱敏配置。
   */
  getConfig(user: UserJwtPayload): Promise<IDuolingoConfig> {
    return this.systemConfigService.getDuolingoConfigMasked(user);
  }

  /**
   * 管理员保存配置，并使旧快照与旧 in-flight generation 失效。
   */
  async setConfig(
    config: IDuolingoConfig,
    user: UserJwtPayload,
  ): Promise<IDuolingoConfig> {
    const saved = await this.systemConfigService.setDuolingoConfig(
      config,
      user,
    );
    this.generation += 1;
    this.cache = { snapshot: null, expiresAt: 0, failureUntil: 0 };
    this.inFlight = undefined;
    return saved;
  }
}
