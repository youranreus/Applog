import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { IDuolingoConfig } from '@applog/common';
import {
  DUOLINGO_BASE_URL,
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

@Injectable()
export class DuolingoClient {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private headers(jwt: string): Record<string, string> {
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${jwt}`,
      'User-Agent': DUOLINGO_USER_AGENT,
    };
  }

  private normalizeError(error: unknown, stage: string): DuolingoClientError {
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
      `Duolingo 请求失败: stage=${stage}, kind=${kind}, status=${status ?? 'unknown'}`,
      DuolingoClient.name,
    );
    return new DuolingoClientError(kind, status);
  }

  /**
   * 获取生成 Landing DTO 所需的两份原始 payload。
   * 凭证只用于服务端请求头，错误与日志均不包含请求配置或响应正文。
   */
  async getLandingData(
    config: IDuolingoConfig,
    startDate: string,
  ): Promise<IDuolingoRawData> {
    const requestConfig = {
      headers: this.headers(config.jwt),
      timeout: DUOLINGO_HTTP_TIMEOUT_MS,
    };
    let userId: string;
    try {
      const lookup = await axios.get<unknown>(
        `${DUOLINGO_BASE_URL}/2017-06-30/users`,
        {
          ...requestConfig,
          params: { username: config.username },
        },
      );
      const resolved = readUserId(lookup.data);
      if (!resolved) throw new DuolingoClientError('schema');
      userId = resolved;
    } catch (error) {
      throw this.normalizeError(error, 'lookup');
    }

    try {
      const [user, summaries] = await Promise.all([
        axios.get<unknown>(
          `${DUOLINGO_BASE_URL}/2023-05-23/users/${encodeURIComponent(userId)}`,
          requestConfig,
        ),
        axios.get<unknown>(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${encodeURIComponent(userId)}/xp_summaries`,
          {
            ...requestConfig,
            params: { startDate },
          },
        ),
      ]);
      return { user: user.data, summaries: summaries.data };
    } catch (error) {
      throw this.normalizeError(error, 'details');
    }
  }
}
