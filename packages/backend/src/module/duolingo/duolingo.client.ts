import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { IDuolingoConfig } from '@applog/common';
import {
  DUOLINGO_BASE_URL,
  DUOLINGO_HTTP_RETRY_DELAY_MS,
  DUOLINGO_HTTP_TIMEOUT_MS,
  DUOLINGO_USER_AGENT,
} from './duolingo.constants';

export type DuolingoClientErrorKind =
  | 'unauthorized'
  | 'timeout'
  | 'upstream'
  | 'schema';

export class DuolingoClientError extends Error {
  constructor(
    public readonly kind: DuolingoClientErrorKind,
    public readonly status?: number,
  ) {
    super(`Duolingo ${kind}`);
    this.name = 'DuolingoClientError';
  }
}

interface IDuolingoRawData {
  user: unknown;
  summaries: unknown;
}

interface IDuolingoRequestConfig {
  headers: Record<string, string>;
  timeout: number;
  params?: Record<string, string>;
}

function readUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const users = (payload as Record<string, unknown>).users;
  if (!Array.isArray(users) || !users[0] || typeof users[0] !== 'object') {
    return null;
  }
  const id = (users[0] as Record<string, unknown>).id;
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  const normalized = String(id).trim();
  return normalized || null;
}

/**
 * 判断错误是否为可重试的网络超时（无 HTTP 响应且为 ECONNABORTED / ETIMEDOUT）。
 * @param error - 捕获的未知错误
 * @returns 是否应按 timeout 重试
 */
function isRetryableTimeout(error: unknown): boolean {
  if (error instanceof DuolingoClientError) return false;
  const axiosError = error as AxiosError;
  if (axiosError.response) return false;
  return axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT';
}

@Injectable()
export class DuolingoClient {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  /** 进程内 username → userId，无 TTL；username 变更自然 miss。 */
  private readonly userIdByUsername = new Map<string, string>();

  private headers(jwt: string): Record<string, string> {
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${jwt}`,
      'User-Agent': DUOLINGO_USER_AGENT,
    };
  }

  /**
   * 短退避等待（单测可覆盖为 no-op）。
   * @param ms - 毫秒
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * 将上游错误归一为无凭证的 DuolingoClientError，并写入含耗时的 warn 日志。
   * @param error - 原始错误或已归一错误
   * @param stage - 请求阶段（lookup / details）
   * @param elapsedMs - 从首次尝试起的墙钟耗时
   * @param attempt - 最终失败时的尝试序号（1 或 2）
   * @returns 归一后的客户端错误
   */
  private normalizeError(
    error: unknown,
    stage: string,
    elapsedMs: number,
    attempt: number,
  ): DuolingoClientError {
    if (error instanceof DuolingoClientError) return error;
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const kind: DuolingoClientErrorKind =
      status === 401 || status === 403
        ? 'unauthorized'
        : axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT'
          ? 'timeout'
          : 'upstream';
    this.logger.warn(
      `Duolingo 请求失败: stage=${stage}, kind=${kind}, status=${status ?? 'unknown'}, elapsedMs=${elapsedMs}, attempt=${attempt}`,
      DuolingoClient.name,
    );
    return new DuolingoClientError(kind, status);
  }

  /**
   * 带计时与超时重试的 GET；仅对网络超时最多再试 1 次。
   * @param url - 完整 URL（不含敏感 query）
   * @param requestConfig - axios 请求配置（含 JWT headers）
   * @param stage - 日志阶段名
   * @returns 响应 body（unknown）
   * @throws {DuolingoClientError} 归一后的上游/超时/鉴权错误
   *
   * 逻辑说明：
   * 1. 最多两次尝试，两次间隔 DUOLINGO_HTTP_RETRY_DELAY_MS
   * 2. 仅 ECONNABORTED / ETIMEDOUT 且无 HTTP status 时重试
   * 3. 最终失败时记录 elapsedMs 与 attempt，不记录 JWT/正文
   */
  private async requestGet(
    url: string,
    requestConfig: IDuolingoRequestConfig,
    stage: string,
  ): Promise<unknown> {
    const maxAttempts = 2;
    const startedAt = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get<unknown>(url, requestConfig);
        return response.data;
      } catch (error) {
        lastError = error;
        if (isRetryableTimeout(error) && attempt < maxAttempts) {
          await this.sleep(DUOLINGO_HTTP_RETRY_DELAY_MS);
          continue;
        }
        throw this.normalizeError(
          error,
          stage,
          Date.now() - startedAt,
          attempt,
        );
      }
    }

    throw this.normalizeError(
      lastError,
      stage,
      Date.now() - startedAt,
      maxAttempts,
    );
  }

  /**
   * 解析 username 对应的 userId；命中内存缓存则跳过 lookup。
   * @param username - 已 trim 的 Duolingo 用户名
   * @param requestConfig - 共享请求配置
   * @returns userId 字符串
   * @throws {DuolingoClientError} lookup 失败或 schema 无效
   */
  private async resolveUserId(
    username: string,
    requestConfig: IDuolingoRequestConfig,
  ): Promise<string> {
    const cached = this.userIdByUsername.get(username);
    if (cached) return cached;

    const data = await this.requestGet(
      `${DUOLINGO_BASE_URL}/2017-06-30/users`,
      {
        ...requestConfig,
        params: { username },
      },
      'lookup',
    );
    const resolved = readUserId(data);
    // schema 失败不写缓存、不打 warn（与历史行为一致；无 HTTP 耗时语义）
    if (!resolved) {
      throw new DuolingoClientError('schema');
    }
    this.userIdByUsername.set(username, resolved);
    return resolved;
  }

  /**
   * 获取生成 Landing DTO 所需的两份原始 payload。
   * 凭证只用于服务端请求头，错误与日志均不包含请求配置或响应正文。
   * @param config - 可用的 Duolingo 配置
   * @param startDate - XP summaries 起始日期 YYYY-MM-DD
   * @returns 主用户数据与 XP summaries 原始 payload
   */
  async getLandingData(
    config: IDuolingoConfig,
    startDate: string,
  ): Promise<IDuolingoRawData> {
    const requestConfig: IDuolingoRequestConfig = {
      headers: this.headers(config.jwt),
      timeout: DUOLINGO_HTTP_TIMEOUT_MS,
    };

    const userId = await this.resolveUserId(config.username, requestConfig);

    const [user, summaries] = await Promise.all([
      this.requestGet(
        `${DUOLINGO_BASE_URL}/2023-05-23/users/${encodeURIComponent(userId)}`,
        requestConfig,
        'details',
      ),
      this.requestGet(
        `${DUOLINGO_BASE_URL}/2017-06-30/users/${encodeURIComponent(userId)}/xp_summaries`,
        {
          ...requestConfig,
          params: { startDate },
        },
        'details',
      ),
    ]);
    return { user, summaries };
  }
}
