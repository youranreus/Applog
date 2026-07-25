import { Inject, Injectable } from '@nestjs/common';
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { IUmamiConfig } from '@applog/common';
import { isUmamiQueryConfigured, normalizeUmamiBaseUrl } from '@applog/common';
import { SystemConfigService } from '@/module/system-config/system-config.service';
import {
  ANALYTICS_TIMEZONE,
  UMAMI_HTTP_TIMEOUT_MS,
} from './analytics.constants';

/**
 * Umami /stats 原始响应（兼容 value 包装）
 */
interface IUmamiStatsRaw {
  pageviews?: number | { value?: number };
  visitors?: number | { value?: number };
  visits?: number | { value?: number };
  bounces?: number | { value?: number };
  totaltime?: number | { value?: number };
}

/**
 * Umami /pageviews 原始响应
 */
interface IUmamiPageviewsRaw {
  pageviews?: Array<{ x: string; y: number }>;
  sessions?: Array<{ x: string; y: number }>;
  visitors?: Array<{ x: string; y: number }>;
}

/**
 * Umami /metrics 单项
 */
export interface IUmamiMetricItem {
  x: string;
  y: number;
}

/**
 * 规范化后的 stats
 */
export interface IUmamiStatsResult {
  pageviews: number;
  visitors: number;
}

/**
 * 规范化后的日序列点
 */
export interface IUmamiPageviewPoint {
  date: string;
  views: number;
  visitors: number;
}

/**
 * Token 缓存条目
 */
interface IUmamiTokenCache {
  token: string;
  baseUrl: string;
  username: string;
  websiteId: string;
}

/**
 * 从 Umami 可能为 number 或 { value } 的字段提取数值
 * @param value - 原始字段
 * @returns 数字，缺省 0
 */
function unwrapUmamiNumber(
  value: number | { value?: number } | undefined,
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === 'object' && typeof value.value === 'number') {
    return value.value;
  }
  return 0;
}

/**
 * 将 ISO/时间戳字符串转为上海日历日 YYYY-MM-DD
 * @param raw - Umami x 字段
 * @returns 日期字符串
 */
function toShanghaiDateKey(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Umami HTTP 客户端：从系统配置读凭证，代理 stats/pageviews/metrics
 */
@Injectable()
export class UmamiClient {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private tokenCache: IUmamiTokenCache | null = null;

  constructor(private readonly systemConfigService: SystemConfigService) {}

  /**
   * 记录日志
   * @param text - 内容
   */
  private log(text: string): void {
    this.logger.log(text, UmamiClient.name);
  }

  /**
   * 记录错误（不包含凭证）
   * @param text - 内容
   */
  private error(text: string): void {
    this.logger.error(text, UmamiClient.name);
  }

  /**
   * 使内存中的 JWT 缓存失效（配置变更后调用）
   */
  invalidateTokenCache(): void {
    this.tokenCache = null;
  }

  /**
   * 加载并校验可用于查询的完整配置
   * @returns 齐备的 IUmamiConfig
   * @throws {BusinessException} 未配置
   */
  async requireQueryConfig(): Promise<IUmamiConfig> {
    const config = await this.systemConfigService.getUmamiConfigRaw();
    if (!isUmamiQueryConfigured(config)) {
      throw new BusinessException(
        '流量服务未配置，请在系统设置中填写 Umami 对接信息',
      );
    }
    return {
      ...config!,
      baseUrl: normalizeUmamiBaseUrl(config!.baseUrl),
    };
  }

  /**
   * 创建指向指定 baseUrl 的 axios 实例
   * @param baseUrl - Umami 根地址
   * @returns AxiosInstance
   */
  private createHttp(baseUrl: string): AxiosInstance {
    return axios.create({
      baseURL: normalizeUmamiBaseUrl(baseUrl),
      timeout: UMAMI_HTTP_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  }

  /**
   * 将 axios/网络错误转为业务异常（不泄露凭证）
   * @param error - 原始错误
   * @param fallback - 默认文案
   * @throws {BusinessException}
   */
  private throwUmamiError(error: unknown, fallback: string): never {
    if (error instanceof BusinessException) {
      throw error;
    }
    const axiosError = error as AxiosError | undefined;
    const status = axiosError?.response?.status;
    if (status === 401 || status === 403) {
      this.error(`Umami 鉴权失败: status=${status}`);
      throw new BusinessException(
        '流量服务鉴权失败，请检查 Umami 用户名与密码',
      );
    }
    this.error(`${fallback}: ${(error as Error)?.message ?? 'unknown'}`);
    throw new BusinessException(fallback);
  }

  /**
   * 登录 Umami 获取 JWT
   * @param config - 完整配置
   * @returns Bearer token
   */
  private async login(config: IUmamiConfig): Promise<string> {
    const http = this.createHttp(config.baseUrl);
    try {
      const response = await http.post<{ token?: string }>('/api/auth/login', {
        username: config.username,
        password: config.password,
      });

      if (
        response.status < 200 ||
        response.status >= 300 ||
        !response.data?.token
      ) {
        this.error(`Umami 登录失败: status=${response.status}`);
        throw new BusinessException(
          '流量服务鉴权失败，请检查 Umami 用户名与密码',
        );
      }

      return response.data.token;
    } catch (error) {
      this.throwUmamiError(error, '无法连接流量服务，请稍后重试');
    }
  }

  /**
   * 获取可用 JWT（内存缓存；配置变更或 401 时刷新）
   * @param config - 完整配置
   * @param forceRefresh - 强制重新登录
   * @returns token
   */
  private async getToken(
    config: IUmamiConfig,
    forceRefresh = false,
  ): Promise<string> {
    const baseUrl = normalizeUmamiBaseUrl(config.baseUrl);
    const cached = this.tokenCache;
    if (
      !forceRefresh &&
      cached &&
      cached.baseUrl === baseUrl &&
      cached.username === config.username &&
      cached.websiteId === config.websiteId
    ) {
      return cached.token;
    }

    const token = await this.login(config);
    this.tokenCache = {
      token,
      baseUrl,
      username: config.username,
      websiteId: config.websiteId,
    };
    this.log('Umami token 已刷新');
    return token;
  }

  /**
   * 带鉴权的 GET；遇 401 刷新 token 重试一次
   * @param config - 配置
   * @param path - 相对路径（含 query）
   * @returns 响应 data
   */
  private async authorizedGet<T>(
    config: IUmamiConfig,
    path: string,
  ): Promise<T> {
    const http = this.createHttp(config.baseUrl);

    /**
     * 单次请求
     * @param token - JWT
     */
    const requestOnce = async (token: string) => {
      return http.get<T>(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
    };

    try {
      let token = await this.getToken(config, false);
      let response = await requestOnce(token);

      if (response.status === 401) {
        this.log('Umami token 失效，尝试重新登录');
        token = await this.getToken(config, true);
        response = await requestOnce(token);
      }

      if (response.status < 200 || response.status >= 300) {
        this.error(`Umami 请求失败: path=${path} status=${response.status}`);
        if (response.status === 401 || response.status === 403) {
          throw new BusinessException(
            '流量服务鉴权失败，请检查 Umami 用户名与密码',
          );
        }
        throw new BusinessException('流量服务暂时不可用，请稍后重试');
      }

      return response.data;
    } catch (error) {
      this.throwUmamiError(error, '流量服务暂时不可用，请稍后重试');
    }
  }

  /**
   * 拉取区间汇总 stats
   * @param startAt - 起始 ms
   * @param endAt - 结束 ms
   * @returns pageviews / visitors
   */
  async getStats(startAt: number, endAt: number): Promise<IUmamiStatsResult> {
    const config = await this.requireQueryConfig();
    const path = `/api/websites/${encodeURIComponent(config.websiteId)}/stats?startAt=${startAt}&endAt=${endAt}`;
    const raw = await this.authorizedGet<IUmamiStatsRaw>(config, path);
    return {
      pageviews: unwrapUmamiNumber(raw.pageviews),
      visitors: unwrapUmamiNumber(raw.visitors),
    };
  }

  /**
   * 拉取按日 pageviews / visitors（sessions）序列
   * @param startAt - 起始 ms
   * @param endAt - 结束 ms
   * @returns 日点列表（未补齐缺日）
   */
  async getPageviews(
    startAt: number,
    endAt: number,
  ): Promise<IUmamiPageviewPoint[]> {
    const config = await this.requireQueryConfig();
    const path =
      `/api/websites/${encodeURIComponent(config.websiteId)}/pageviews` +
      `?startAt=${startAt}&endAt=${endAt}&unit=day&timezone=${encodeURIComponent(ANALYTICS_TIMEZONE)}`;
    const raw = await this.authorizedGet<IUmamiPageviewsRaw>(config, path);

    const viewsMap = new Map<string, number>();
    (raw.pageviews ?? []).forEach((item) => {
      viewsMap.set(toShanghaiDateKey(item.x), Number(item.y) || 0);
    });

    const visitorsSeries = raw.visitors ?? raw.sessions ?? [];
    const visitorsMap = new Map<string, number>();
    visitorsSeries.forEach((item) => {
      visitorsMap.set(toShanghaiDateKey(item.x), Number(item.y) || 0);
    });

    const allDates = new Set<string>([
      ...viewsMap.keys(),
      ...visitorsMap.keys(),
    ]);

    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date,
        views: viewsMap.get(date) ?? 0,
        visitors: visitorsMap.get(date) ?? 0,
      }));
  }

  /**
   * 拉取 metrics 分布
   * @param type - Umami metrics type
   * @param startAt - 起始 ms
   * @param endAt - 结束 ms
   * @param limit - 条数
   * @returns 指标列表
   */
  async getMetrics(
    type: string,
    startAt: number,
    endAt: number,
    limit: number,
  ): Promise<IUmamiMetricItem[]> {
    const config = await this.requireQueryConfig();
    const path =
      `/api/websites/${encodeURIComponent(config.websiteId)}/metrics` +
      `?startAt=${startAt}&endAt=${endAt}&type=${encodeURIComponent(type)}&limit=${limit}`;
    const raw = await this.authorizedGet<IUmamiMetricItem[]>(config, path);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => ({
      x: String(item.x ?? ''),
      y: Number(item.y) || 0,
    }));
  }
}
