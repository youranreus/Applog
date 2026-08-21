import { Inject, Injectable } from '@nestjs/common';
import axios, { type AxiosError } from 'axios';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import type { IWakaTimeConfig } from '@applog/common';
import {
  WAKATIME_HTTP_RETRY_DELAY_MS,
  WAKATIME_HTTP_TIMEOUT_MS,
  WAKATIME_SUMMARIES_URL,
} from './wakatime.constants';

export type WakaTimeClientErrorKind =
  | 'unauthorized'
  | 'payment'
  | 'rate_limited'
  | 'timeout'
  | 'schema'
  | 'upstream';

export class WakaTimeClientError extends Error {
  constructor(
    public readonly kind: WakaTimeClientErrorKind,
    public readonly status?: number,
  ) {
    super(`WakaTime ${kind}`);
    this.name = 'WakaTimeClientError';
  }
}

function isRetryableTimeout(error: unknown): boolean {
  const axiosError = error as AxiosError;
  return (
    !axiosError.response &&
    (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT')
  );
}

@Injectable()
export class WakaTimeClient {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private normalizeError(
    error: unknown,
    elapsedMs: number,
    attempt: number,
  ): WakaTimeClientError {
    if (error instanceof WakaTimeClientError) return error;
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const kind: WakaTimeClientErrorKind =
      status === 401 || status === 403
        ? 'unauthorized'
        : status === 402
          ? 'payment'
          : status === 429
            ? 'rate_limited'
            : isRetryableTimeout(error)
              ? 'timeout'
              : 'upstream';
    this.logger.warn(
      `WakaTime 请求失败: stage=summaries, kind=${kind}, status=${status ?? 'unknown'}, elapsedMs=${elapsedMs}, attempt=${attempt}`,
      WakaTimeClient.name,
    );
    return new WakaTimeClientError(kind, status);
  }

  /** 仅通过 Basic Auth header 请求最近 30 个自然日的 Summaries。 */
  async getSummaries(
    config: IWakaTimeConfig,
    startDate: string,
    endDate: string,
  ): Promise<unknown> {
    const startedAt = Date.now();
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await axios.get<unknown>(WAKATIME_SUMMARIES_URL, {
          auth: { username: config.apiKey, password: '' },
          headers: { Accept: 'application/json' },
          timeout: WAKATIME_HTTP_TIMEOUT_MS,
          params: {
            start: startDate,
            end: endDate,
            timezone: config.timeZone,
          },
        });
        return response.data;
      } catch (error) {
        lastError = error;
        if (isRetryableTimeout(error) && attempt === 1) {
          await this.sleep(WAKATIME_HTTP_RETRY_DELAY_MS);
          continue;
        }
        throw this.normalizeError(error, Date.now() - startedAt, attempt);
      }
    }
    throw this.normalizeError(lastError, Date.now() - startedAt, 2);
  }
}
