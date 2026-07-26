import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import type { IUmamiConfig, IUmamiTrackerConfig } from '@applog/common';
import { toUmamiTrackerConfig } from '@applog/common';
import { PostEntity, PageEntity } from '@/entities';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import { UmamiClient } from './umami.client';
import type {
  IAnalyticsSummaryDto,
  IAnalyticsActiveDto,
  IAnalyticsTrendPointDto,
  IAnalyticsTopItemDto,
  IAnalyticsBreakdownItemDto,
  AnalyticsBreakdownDimension,
} from './dto';
import {
  ANALYTICS_DEFAULT_BREAKDOWN_LIMIT,
  ANALYTICS_DEFAULT_TOP_LIMIT,
  ANALYTICS_DEFAULT_TREND_DAYS,
  ANALYTICS_SUMMARY_DAYS,
  ANALYTICS_ACTIVE_CACHE_TTL_MS,
} from './analytics.constants';
import {
  buildShanghaiDateRange,
  getShanghaiDateString,
  getShanghaiDaysWindow,
} from './umami-time.utils';

/**
 * path → 内容类型解析结果
 */
interface IPathContentRef {
  kind: 'post' | 'page';
  slug: string;
}

/**
 * Analytics 服务：Umami 代理查询 + Tracker 引导 + 管理端配置
 * 旧自建日聚合表保留但不读写
 */
@Injectable()
export class AnalyticsService {
  @InjectRepository(PostEntity)
  private postRepo: Repository<PostEntity>;

  @InjectRepository(PageEntity)
  private pageRepo: Repository<PageEntity>;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(
    private readonly umamiClient: UmamiClient,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  private activeVisitorsCache: {
    expiresAt: number;
    value: number | null;
  } | null = null;
  private activeVisitorsGeneration = 0;
  private activeVisitorsInFlight: {
    generation: number;
    promise: Promise<IAnalyticsActiveDto>;
  } | null = null;

  /**
   * 记录日志
   * @param text - 日志内容
   */
  private log(text: string): void {
    this.logger.log(text, AnalyticsService.name);
  }

  /**
   * 记录错误日志
   * @param text - 错误内容
   */
  private error(text: string): void {
    this.logger.error(text, AnalyticsService.name);
  }

  /**
   * 公开 Tracker 引导（无凭证）
   * @returns enabled / scriptUrl / websiteId
   */
  async getTrackerConfig(): Promise<IUmamiTrackerConfig> {
    try {
      const raw = await this.systemConfigService.getUmamiConfigRaw();
      return toUmamiTrackerConfig(raw);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`读取 Tracker 配置失败: ${(error as Error).message}`);
      return { enabled: false, scriptUrl: '', websiteId: '' };
    }
  }

  /**
   * 公开读取当前在线人数。
   * Umami 未配置或暂时不可用时降级为 null，不影响公开首页。
   * @returns 在线人数 DTO
   */
  async getActiveVisitors(): Promise<IAnalyticsActiveDto> {
    const now = Date.now();
    const generation = this.activeVisitorsGeneration;
    if (this.activeVisitorsCache?.expiresAt > now) {
      return { visitors: this.activeVisitorsCache.value };
    }

    if (this.activeVisitorsInFlight?.generation === generation) {
      return this.activeVisitorsInFlight.promise;
    }

    const promise = this.loadActiveVisitors(generation);
    this.activeVisitorsInFlight = { generation, promise };
    try {
      return await promise;
    } finally {
      if (this.activeVisitorsInFlight?.promise === promise) {
        this.activeVisitorsInFlight = null;
      }
    }
  }

  /**
   * 实际读取并缓存当前在线人数。
   * @returns 在线人数 DTO
   */
  private async loadActiveVisitors(
    generation: number,
  ): Promise<IAnalyticsActiveDto> {
    try {
      const visitors = await this.umamiClient.getActiveVisitors();
      if (visitors === null) {
        this.error('Umami 当前在线人数响应无法识别');
      }
      if (generation === this.activeVisitorsGeneration) {
        this.activeVisitorsCache = {
          expiresAt: Date.now() + ANALYTICS_ACTIVE_CACHE_TTL_MS,
          value: visitors,
        };
      }
      return { visitors };
    } catch (error) {
      this.error(`查询当前在线人数失败: ${(error as Error).message}`);
      if (generation === this.activeVisitorsGeneration) {
        this.activeVisitorsCache = {
          expiresAt: Date.now() + ANALYTICS_ACTIVE_CACHE_TTL_MS,
          value: null,
        };
      }
      return { visitors: null };
    }
  }

  /**
   * 管理员读取脱敏 Umami 配置
   * @param user - 当前管理员
   * @returns 脱敏配置
   */
  async getUmamiConfig(user: UserJwtPayload): Promise<IUmamiConfig> {
    return this.systemConfigService.getUmamiConfigMasked(user);
  }

  /**
   * 管理员保存 Umami 配置，并失效 token 缓存
   * @param payload - 表单配置
   * @param user - 当前管理员
   * @returns 脱敏后的最新配置
   */
  async setUmamiConfig(
    payload: IUmamiConfig,
    user: UserJwtPayload,
  ): Promise<IUmamiConfig> {
    const saved = await this.systemConfigService.setUmamiConfig(payload, user);
    this.umamiClient.invalidateTokenCache();
    this.activeVisitorsGeneration += 1;
    this.activeVisitorsCache = null;
    this.activeVisitorsInFlight = null;
    this.log('Umami 配置已更新，token 缓存已失效');
    return saved;
  }

  /**
   * 站点流量摘要（今日 + 近 7 日）
   * @returns 摘要 DTO
   */
  async getSummary(): Promise<IAnalyticsSummaryDto> {
    try {
      const todayWindow = getShanghaiDaysWindow(1);
      const last7Window = getShanghaiDaysWindow(ANALYTICS_SUMMARY_DAYS);

      const [todayStats, last7Stats] = await Promise.all([
        this.umamiClient.getStats(todayWindow.startAt, todayWindow.endAt),
        this.umamiClient.getStats(last7Window.startAt, last7Window.endAt),
      ]);

      return {
        todayViews: todayStats.pageviews,
        todayVisitors: todayStats.visitors,
        last7DaysViews: last7Stats.pageviews,
        last7DaysVisitors: last7Stats.visitors,
      };
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询流量摘要失败: ${(error as Error).message}`);
      throw new BusinessException('查询流量摘要失败，请稍后重试');
    }
  }

  /**
   * 站点日趋势序列（缺日补 0）
   * @param days - 天数，默认 30
   * @returns 升序日序列
   */
  async getTrend(
    days = ANALYTICS_DEFAULT_TREND_DAYS,
  ): Promise<IAnalyticsTrendPointDto[]> {
    try {
      const window = getShanghaiDaysWindow(days);
      const dates = buildShanghaiDateRange(window.endDate, days);
      const points = await this.umamiClient.getPageviews(
        window.startAt,
        window.endAt,
      );
      const map = new Map(points.map((p) => [p.date, p]));

      return dates.map((date) => {
        const point = map.get(date);
        return {
          date,
          views: point?.views ?? 0,
          visitors: point?.visitors ?? 0,
        };
      });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询流量趋势失败: ${(error as Error).message}`);
      throw new BusinessException('查询流量趋势失败，请稍后重试');
    }
  }

  /**
   * 从 path 解析文章/页面 slug
   * @param path - Umami path（可能带 query）
   * @returns 内容引用或 null
   */
  private parseContentPath(path: string): IPathContentRef | null {
    const pathname = path.split('?')[0].split('#')[0];
    const archivesMatch = pathname.match(/^\/archives\/([^/]+)\.html$/);
    if (archivesMatch) {
      return { kind: 'post', slug: decodeURIComponent(archivesMatch[1]) };
    }
    const pageMatch = pathname.match(/^\/([^/]+)\.html$/);
    if (pageMatch) {
      return { kind: 'page', slug: decodeURIComponent(pageMatch[1]) };
    }
    return null;
  }

  /**
   * 批量解析 path → 标题
   * @param paths - path 列表
   * @returns path → title
   */
  private async resolvePathTitles(
    paths: string[],
  ): Promise<Map<string, string>> {
    const titleMap = new Map<string, string>();
    const postSlugs: string[] = [];
    const pageSlugs: string[] = [];
    const pathRefs = new Map<string, IPathContentRef>();

    paths.forEach((path) => {
      const ref = this.parseContentPath(path);
      if (!ref) {
        return;
      }
      pathRefs.set(path, ref);
      if (ref.kind === 'post') {
        postSlugs.push(ref.slug);
      } else {
        pageSlugs.push(ref.slug);
      }
    });

    const slugToPostTitle = new Map<string, string>();
    const slugToPageTitle = new Map<string, string>();

    if (postSlugs.length > 0) {
      const posts = await this.postRepo.find({
        where: { slug: In([...new Set(postSlugs)]) },
        select: ['slug', 'title'],
      });
      posts.forEach((p) => slugToPostTitle.set(p.slug, p.title));
    }

    if (pageSlugs.length > 0) {
      const pages = await this.pageRepo.find({
        where: { slug: In([...new Set(pageSlugs)]) },
        select: ['slug', 'title'],
      });
      pages.forEach((p) => slugToPageTitle.set(p.slug, p.title));
    }

    pathRefs.forEach((ref, path) => {
      const title =
        ref.kind === 'post'
          ? slugToPostTitle.get(ref.slug)
          : slugToPageTitle.get(ref.slug);
      if (title) {
        titleMap.set(path, title);
      }
    });

    return titleMap;
  }

  /**
   * 热门页面 Top（近 N 日 path metrics + 标题映射）
   * @param days - 天数
   * @param limit - 条数
   * @returns Top 列表
   */
  async getTop(
    days = ANALYTICS_DEFAULT_TREND_DAYS,
    limit = ANALYTICS_DEFAULT_TOP_LIMIT,
  ): Promise<IAnalyticsTopItemDto[]> {
    try {
      const window = getShanghaiDaysWindow(days);
      const metrics = await this.umamiClient.getMetrics(
        'path',
        window.startAt,
        window.endAt,
        limit,
      );

      const paths = metrics.map((m) => m.x).filter(Boolean);
      const titleMap = await this.resolvePathTitles(paths);

      return metrics.map((item) => {
        const path = item.x || '/';
        const href = path.startsWith('/') ? path : `/${path}`;
        return {
          path,
          title: titleMap.get(path) ?? path,
          views: item.y,
          href,
        };
      });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询热门页面失败: ${(error as Error).message}`);
      throw new BusinessException('查询热门页面失败，请稍后重试');
    }
  }

  /**
   * 设备 / OS / 地域分布
   * @param dimension - os | device | country
   * @param days - 天数
   * @param limit - 条数
   * @returns 分布列表
   */
  async getBreakdown(
    dimension: AnalyticsBreakdownDimension,
    days = ANALYTICS_DEFAULT_TREND_DAYS,
    limit = ANALYTICS_DEFAULT_BREAKDOWN_LIMIT,
  ): Promise<IAnalyticsBreakdownItemDto[]> {
    try {
      const window = getShanghaiDaysWindow(days);
      const metrics = await this.umamiClient.getMetrics(
        dimension,
        window.startAt,
        window.endAt,
        limit,
      );

      return metrics.map((item) => ({
        name: item.x || '未知',
        value: item.y,
      }));
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.error(`查询流量分布失败: ${(error as Error).message}`);
      throw new BusinessException('查询流量分布失败，请稍后重试');
    }
  }

  /**
   * 当前上海日历日（测试/调试用）
   * @returns YYYY-MM-DD
   */
  getShanghaiDateString(date?: Date): string {
    return getShanghaiDateString(date);
  }
}
