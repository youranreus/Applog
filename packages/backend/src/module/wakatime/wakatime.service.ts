import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  isWakaTimeConfigured,
  type IWakaTimeConfig,
  type IWakaTimeLandingStats,
} from '@applog/common';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import {
  WAKATIME_FAILURE_CACHE_TTL_MS,
  WAKATIME_SUCCESS_CACHE_TTL_MS,
} from './wakatime.constants';
import { WakaTimeClient, WakaTimeClientError } from './wakatime.client';
import {
  buildWakaTimeLandingStats,
  getWakaTimeDateRange,
  WakaTimePayloadSchemaError,
} from './wakatime.utils';

interface IWakaTimeCache {
  snapshot: IWakaTimeLandingStats | null;
  expiresAt: number;
  failureUntil: number;
}

@Injectable()
export class WakaTimeService implements OnModuleInit, OnModuleDestroy {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private cache: IWakaTimeCache = {
    snapshot: null,
    expiresAt: 0,
    failureUntil: 0,
  };
  private generation = 0;
  private inFlight:
    | { generation: number; promise: Promise<IWakaTimeLandingStats | null> }
    | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly client: WakaTimeClient,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  onModuleInit(): void {
    void this.refreshFromStoredConfig();
    this.refreshTimer = setInterval(() => {
      void this.refreshFromStoredConfig();
    }, WAKATIME_SUCCESS_CACHE_TTL_MS);
    this.refreshTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  /**
   * 公开请求只读取进程内快照，不发起/等待 WakaTime 请求。
   */
  getLandingStats(): IWakaTimeLandingStats | null {
    if (!this.cache.snapshot) return null;
    return {
      ...this.cache.snapshot,
      stale: this.cache.expiresAt <= Date.now(),
    };
  }

  /** 由启动、定时器和配置保存触发的后台刷新。 */
  async refreshFromStoredConfig(): Promise<IWakaTimeLandingStats | null> {
    let config: IWakaTimeConfig | null;
    try {
      config = await this.systemConfigService.getWakaTimeConfigRaw();
    } catch {
      this.logger.warn(
        'WakaTime 统计刷新失败: kind=config',
        WakaTimeService.name,
      );
      return this.getLandingStats();
    }
    if (!isWakaTimeConfigured(config)) {
      this.cache = { snapshot: null, expiresAt: 0, failureUntil: 0 };
      return null;
    }
    if (this.cache.failureUntil > Date.now()) return this.getLandingStats();
    return this.refresh(config, this.generation);
  }

  private refresh(
    config: IWakaTimeConfig,
    generation: number,
  ): Promise<IWakaTimeLandingStats | null> {
    if (this.inFlight?.generation === generation) return this.inFlight.promise;
    const promise = this.load(config, generation);
    this.inFlight = { generation, promise };
    void promise.finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = undefined;
    });
    return promise;
  }

  private async load(
    config: IWakaTimeConfig,
    generation: number,
  ): Promise<IWakaTimeLandingStats | null> {
    try {
      const range = getWakaTimeDateRange(config.timeZone);
      const raw = await this.client.getSummaries(
        config,
        range.startDate,
        range.endDate,
      );
      const snapshot = buildWakaTimeLandingStats(raw, config.timeZone, range);
      if (generation !== this.generation) return null;
      this.cache = {
        snapshot,
        expiresAt: Date.now() + WAKATIME_SUCCESS_CACHE_TTL_MS,
        failureUntil: 0,
      };
      return snapshot;
    } catch (error) {
      const kind =
        error instanceof WakaTimeClientError
          ? error.kind
          : error instanceof WakaTimePayloadSchemaError
            ? 'schema'
            : 'upstream';
      this.logger.warn(
        `WakaTime 统计刷新失败: kind=${kind}`,
        WakaTimeService.name,
      );
      if (generation !== this.generation) return null;
      this.cache.failureUntil = Date.now() + WAKATIME_FAILURE_CACHE_TTL_MS;
      if (this.cache.snapshot) {
        this.cache.expiresAt = 0;
        return { ...this.cache.snapshot, stale: true };
      }
      return null;
    }
  }

  getConfig(user: UserJwtPayload): Promise<IWakaTimeConfig> {
    return this.systemConfigService.getWakaTimeConfigMasked(user);
  }

  async setConfig(
    config: IWakaTimeConfig,
    user: UserJwtPayload,
  ): Promise<IWakaTimeConfig> {
    const saved = await this.systemConfigService.setWakaTimeConfig(
      config,
      user,
    );
    this.generation += 1;
    this.cache = { snapshot: null, expiresAt: 0, failureUntil: 0 };
    this.inFlight = undefined;
    void this.refreshFromStoredConfig();
    return saved;
  }
}
