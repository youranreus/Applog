import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import axios, { type AxiosError } from 'axios';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import {
  FlomoSourceError,
  type FlomoSourceAdapter,
  type IFlomoSourceCursor,
  type IFlomoSourceMemo,
  type IFlomoSourceResult,
} from './flomo-source.types';

export const FLOMO_WEB_UPDATED_URL =
  'https://flomoapp.com/api/v1/memo/updated/';
export const FLOMO_SOURCE_PAGE_SIZE = 200;
const SIGNATURE_SECRET = 'dbbc3dd73364b4084c3a69346e0ce2b2';
const MAX_PAGES = 500;
const MAX_ATTEMPTS = 2;
const MAX_PAGE_BYTES = 10 * 1024 * 1024;

type SignValue = string | number | readonly string[];

/** Reproduce the current private Web signature. Kept replaceable and fixture-testable. */
export function buildFlomoWebSignature(
  params: Record<string, SignValue>,
): string {
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (Array.isArray(value)) {
      for (const item of [...value].sort()) parts.push(`${key}[]=${item}`);
    } else if (`${value}` !== '') {
      parts.push(`${key}=${value}`);
    }
  }
  return createHash('md5')
    .update(`${parts.join('&')}${SIGNATURE_SECRET}`)
    .digest('hex');
}

function formatSourceCursor(value: Date | null): string | number {
  if (!value) return '';
  return Math.floor(value.getTime() / 1000);
}

function parseSourceDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !value.trim())
    throw new FlomoSourceError('schema');
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
    ? `${value.replace(' ', 'T')}+08:00`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new FlomoSourceError('schema');
  void field;
  return parsed;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function decodeMemo(value: unknown): IFlomoSourceMemo {
  const raw = record(value);
  if (!raw || typeof raw.slug !== 'string' || !raw.slug.trim()) {
    throw new FlomoSourceError('schema');
  }
  const deleted =
    raw.deleted_at !== null &&
    raw.deleted_at !== undefined &&
    raw.deleted_at !== '';
  const tags = raw.tags ?? (deleted ? [] : undefined);
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
    throw new FlomoSourceError('schema');
  }
  const content = raw.content ?? raw.content_html ?? (deleted ? '' : undefined);
  if (typeof content !== 'string') throw new FlomoSourceError('schema');
  return {
    slug: raw.slug,
    contentHtml: content,
    tags: tags as string[],
    createdAt: parseSourceDate(raw.created_at, 'created_at'),
    updatedAt: parseSourceDate(raw.updated_at, 'updated_at'),
    deleted,
  };
}

function decodePage(value: unknown): IFlomoSourceMemo[] {
  const root = record(value);
  if (!root) throw new FlomoSourceError('schema');
  if (typeof root.code === 'number' && root.code !== 0) {
    throw new FlomoSourceError(
      root.code === -1 ? 'unauthorized' : 'compatibility',
    );
  }
  const data = root.data;
  const dataRecord = record(data);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(dataRecord?.items)
      ? dataRecord.items
      : Array.isArray(dataRecord?.memos)
        ? dataRecord.memos
        : null;
  if (!items) throw new FlomoSourceError('schema');
  return items.map(decodeMemo);
}

function compareCursor(
  left: IFlomoSourceCursor,
  right: IFlomoSourceCursor,
): number {
  const leftTime = left.updatedAt?.getTime() ?? -1;
  const rightTime = right.updatedAt?.getTime() ?? -1;
  return leftTime === rightTime
    ? left.slug === right.slug
      ? 0
      : left.slug > right.slug
        ? 1
        : -1
    : leftTime - rightTime;
}

@Injectable()
export class FlomoWebSourceAdapter implements FlomoSourceAdapter {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  async fetchChanges(
    token: string,
    initial: IFlomoSourceCursor,
  ): Promise<IFlomoSourceResult> {
    const memos: IFlomoSourceMemo[] = [];
    const seenPageCursors = new Set<string>();
    let pageCursor = { ...initial };
    let highWater = { ...initial };

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const pageMemos = await this.fetchPage(token, pageCursor);
      memos.push(...pageMemos);
      for (const memo of pageMemos) {
        const candidate = { updatedAt: memo.updatedAt, slug: memo.slug };
        if (compareCursor(candidate, highWater) > 0) highWater = candidate;
      }
      if (pageMemos.length < FLOMO_SOURCE_PAGE_SIZE)
        return { memos, cursor: highWater };

      const last = pageMemos.at(-1);
      if (!last) return { memos, cursor: highWater };
      const next = { updatedAt: last.updatedAt, slug: last.slug };
      const key = `${next.updatedAt.toISOString()}\0${next.slug}`;
      if (seenPageCursors.has(key) || compareCursor(next, pageCursor) <= 0) {
        throw new FlomoSourceError('compatibility');
      }
      seenPageCursors.add(key);
      pageCursor = next;
    }
    throw new FlomoSourceError('compatibility');
  }

  private async fetchPage(
    token: string,
    cursor: IFlomoSourceCursor,
  ): Promise<IFlomoSourceMemo[]> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      try {
        const params: Record<string, SignValue> = {
          limit: FLOMO_SOURCE_PAGE_SIZE,
          latest_updated_at: formatSourceCursor(cursor.updatedAt),
          latest_slug: cursor.slug,
          tz: '8:0',
          timestamp: Math.floor(Date.now() / 1000),
          api_key: 'flomo_web',
          app_version: '4.0',
          platform: 'web',
          webp: 1,
        };
        const response = await axios.get<unknown>(FLOMO_WEB_UPDATED_URL, {
          params: { ...params, sign: buildFlomoWebSignature(params) },
          timeout: 10_000,
          maxContentLength: MAX_PAGE_BYTES,
          maxBodyLength: MAX_PAGE_BYTES,
          headers: {
            Accept: 'application/json, text/plain, */*',
            Authorization: `Bearer ${token}`,
            Origin: 'https://v.flomoapp.com',
            Referer: 'https://v.flomoapp.com/',
            'device-id': '503b6439-1884-443d-b04e-0828bf9f138f',
            'device-model': 'Chrome',
            platform: 'Web',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        return decodePage(response.data);
      } catch (error) {
        lastError = error;
        const normalized = this.normalizeError(error);
        this.logger.warn(
          `Flomo 请求失败: stage=updated, kind=${normalized.category}, status=${normalized.status ?? 'unknown'}, elapsedMs=${Date.now() - startedAt}, attempt=${attempt}`,
          FlomoWebSourceAdapter.name,
        );
        if (attempt < MAX_ATTEMPTS && this.isRetryable(normalized)) {
          await this.sleep(this.retryDelay(error));
          continue;
        }
        throw normalized;
      }
    }
    throw this.normalizeError(lastError);
  }

  private normalizeError(error: unknown): FlomoSourceError {
    if (error instanceof FlomoSourceError) return error;
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const category =
      status === 401 || status === 403
        ? 'unauthorized'
        : status === 429
          ? 'rate_limited'
          : !status &&
              (axiosError.code === 'ECONNABORTED' ||
                axiosError.code === 'ETIMEDOUT')
            ? 'timeout'
            : status && status >= 500
              ? 'upstream'
              : 'compatibility';
    return new FlomoSourceError(category, status);
  }

  private isRetryable(error: FlomoSourceError): boolean {
    return (
      error.category === 'rate_limited' ||
      error.category === 'timeout' ||
      error.category === 'upstream'
    );
  }

  private retryDelay(error: unknown): number {
    const header = (error as AxiosError).response?.headers?.['retry-after'];
    if (typeof header !== 'string') return 300;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      return Math.min(2_000, Math.max(0, seconds * 1_000));
    }
    const retryAt = Date.parse(header);
    return Number.isNaN(retryAt)
      ? 300
      : Math.min(2_000, Math.max(0, retryAt - Date.now()));
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
