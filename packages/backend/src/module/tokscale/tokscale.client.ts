import { Inject, Injectable } from '@nestjs/common';
import axios, { type AxiosError } from 'axios';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import {
  TOKSCALE_HTTP_RETRY_DELAY_MS,
  TOKSCALE_HTTP_TIMEOUT_MS,
  TOKSCALE_PERIOD,
  TOKSCALE_PROFILE_URL_TEMPLATE,
} from './tokscale.constants';

export type TokscaleClientErrorKind =
  | 'not_found'
  | 'ambiguous'
  | 'rate_limited'
  | 'timeout'
  | 'schema'
  | 'upstream';

export class TokscaleClientError extends Error {
  constructor(
    public readonly kind: TokscaleClientErrorKind,
    public readonly status?: number,
  ) {
    super(`Tokscale ${kind}`);
    this.name = 'TokscaleClientError';
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
export class TokscaleClient {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private normalizeError(
    error: unknown,
    elapsedMs: number,
    attempt: number,
  ): TokscaleClientError {
    if (error instanceof TokscaleClientError) return error;
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const kind: TokscaleClientErrorKind =
      status === 404
        ? 'not_found'
        : status === 409
          ? 'ambiguous'
          : status === 429
            ? 'rate_limited'
            : isRetryableTimeout(error)
              ? 'timeout'
              : 'upstream';
    this.logger.warn(
      `Tokscale 请求失败: kind=${kind}, status=${status ?? 'unknown'}, elapsedMs=${elapsedMs}, attempt=${attempt}`,
      TokscaleClient.name,
    );
    return new TokscaleClientError(kind, status);
  }

  /** 请求 Tokscale 公开用户 profile；不发送任何凭证。 */
  async getUserProfile(username: string): Promise<unknown> {
    const startedAt = Date.now();
    const url = TOKSCALE_PROFILE_URL_TEMPLATE.replace(
      '{username}',
      encodeURIComponent(username),
    );
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await axios.get<unknown>(url, {
          headers: { Accept: 'application/json' },
          timeout: TOKSCALE_HTTP_TIMEOUT_MS,
          maxRedirects: 5,
          params: { period: TOKSCALE_PERIOD },
        });
        return response.data;
      } catch (error) {
        lastError = error;
        if (isRetryableTimeout(error) && attempt === 1) {
          await this.sleep(TOKSCALE_HTTP_RETRY_DELAY_MS);
          continue;
        }
        throw this.normalizeError(error, Date.now() - startedAt, attempt);
      }
    }
    throw this.normalizeError(lastError, Date.now() - startedAt, 2);
  }
}
