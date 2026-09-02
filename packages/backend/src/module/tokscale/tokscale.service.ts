import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { ITokscaleLandingStats } from '@applog/common';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import { TokscaleClient, TokscaleClientError } from './tokscale.client';
import {
  TOKSCALE_FAILURE_CACHE_TTL_MS,
  TOKSCALE_SUCCESS_CACHE_TTL_MS,
} from './tokscale.constants';
import {
  buildTokscaleLandingStats,
  TokscalePayloadSchemaError,
} from './tokscale.utils';

interface ITokscaleCache {
  snapshot: ITokscaleLandingStats | null;
  expiresAt: number;
  failureUntil: number;
}

@Injectable()
export class TokscaleService implements OnModuleInit, OnModuleDestroy {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private cache: ITokscaleCache = {
    snapshot: null,
    expiresAt: 0,
    failureUntil: 0,
  };
  private generation = 0;
  private username: string | null = null;
  private inFlight:
    | { generation: number; promise: Promise<ITokscaleLandingStats | null> }
    | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private unregisterBaseConfigListener: (() => void) | undefined;

  constructor(
    private readonly client: TokscaleClient,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  onModuleInit(): void {
    this.unregisterBaseConfigListener =
      this.systemConfigService.onBaseConfigChanged(() => {
        void this.refreshFromStoredConfig();
      });
    void this.refreshFromStoredConfig();
    this.refreshTimer = setInterval(() => {
      void this.refreshFromStoredConfig();
    }, TOKSCALE_SUCCESS_CACHE_TTL_MS);
    this.refreshTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
    this.unregisterBaseConfigListener?.();
    this.unregisterBaseConfigListener = undefined;
  }

  /** 公开请求只读取进程内快照，不发起/等待 Tokscale 请求。 */
  getLandingStats(): ITokscaleLandingStats | null {
    if (!this.cache.snapshot) return null;
    return {
      ...this.cache.snapshot,
      stale: this.cache.expiresAt <= Date.now(),
    };
  }

  /** 启动、定时器触发的后台刷新；每次重读 base config username。 */
  async refreshFromStoredConfig(): Promise<ITokscaleLandingStats | null> {
    let nextUsername = '';
    try {
      const config = await this.systemConfigService.getBaseConfigRaw();
      nextUsername =
        typeof config?.tokscaleUsername === 'string'
          ? config.tokscaleUsername.trim()
          : '';
    } catch {
      this.logger.warn(
        'Tokscale 统计刷新失败: kind=config',
        TokscaleService.name,
      );
      return this.getLandingStats();
    }

    if (nextUsername !== this.username) {
      this.username = nextUsername || null;
      this.generation += 1;
      this.cache = { snapshot: null, expiresAt: 0, failureUntil: 0 };
      this.inFlight = undefined;
    }
    if (!nextUsername) return null;
    const now = Date.now();
    if (this.cache.snapshot && this.cache.expiresAt > now) {
      return { ...this.cache.snapshot, stale: false };
    }
    if (this.cache.failureUntil > now) return this.getLandingStats();
    return this.refresh(nextUsername, this.generation);
  }

  private refresh(
    username: string,
    generation: number,
  ): Promise<ITokscaleLandingStats | null> {
    if (this.inFlight?.generation === generation) return this.inFlight.promise;
    const promise = this.load(username, generation);
    this.inFlight = { generation, promise };
    void promise.finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = undefined;
    });
    return promise;
  }

  private async load(
    username: string,
    generation: number,
  ): Promise<ITokscaleLandingStats | null> {
    try {
      const raw = await this.client.getUserProfile(username);
      const snapshot = buildTokscaleLandingStats(raw);
      if (generation !== this.generation || username !== this.username)
        return null;
      this.cache = {
        snapshot,
        expiresAt: Date.now() + TOKSCALE_SUCCESS_CACHE_TTL_MS,
        failureUntil: 0,
      };
      return snapshot;
    } catch (error) {
      const kind =
        error instanceof TokscaleClientError
          ? error.kind
          : error instanceof TokscalePayloadSchemaError
            ? 'schema'
            : 'upstream';
      this.logger.warn(
        `Tokscale 统计刷新失败: kind=${kind}`,
        TokscaleService.name,
      );
      if (generation !== this.generation || username !== this.username)
        return null;
      this.cache.failureUntil = Date.now() + TOKSCALE_FAILURE_CACHE_TTL_MS;
      if (this.cache.snapshot) {
        this.cache.expiresAt = 0;
        return { ...this.cache.snapshot, stale: true };
      }
      return null;
    }
  }
}
