import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import axios from 'axios';
import {
  H_NOTIFICATION_DEFAULT_BASE_URL,
  H_NOTIFICATION_MAX_ATTEMPTS,
  H_NOTIFICATION_TIMEOUT_MS,
} from './notification.constants';
import type {
  HNotificationResponse,
  HTemplateNotificationRequest,
} from './notification.types';

export class NotificationClientError extends Error {
  constructor(
    public readonly kind: 'transport' | 'http' | 'schema',
    public readonly status?: number,
  ) {
    super(`H notification ${kind}`);
    this.name = 'NotificationClientError';
  }
}

@Injectable()
export class NotificationClient {
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(private readonly config: ConfigService) {}

  async send(
    mailToken: string,
    payload: HTemplateNotificationRequest,
    trace: { eventKind: string; commentId: number; batchIndex: number },
  ): Promise<void> {
    let lastError: NotificationClientError | undefined;
    for (
      let attempt = 1;
      attempt <= H_NOTIFICATION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const response = await axios.post<HNotificationResponse>(
          `${this.baseUrl()}/v1/notifications`,
          payload,
          {
            timeout: H_NOTIFICATION_TIMEOUT_MS,
            headers: {
              Authorization: `NotificationKey ${mailToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (response.data?.code !== 0 || !response.data?.data?.notificationId) {
          throw new NotificationClientError('schema', response.status);
        }
        this.logger.log(
          `H 通知已入队 event=${trace.eventKind} commentId=${trace.commentId} batch=${trace.batchIndex} attempt=${attempt} notificationId=${response.data.data.notificationId}`,
          NotificationClient.name,
        );
        return;
      } catch (error) {
        lastError = this.normalizeError(error);
        const retryable =
          lastError.kind === 'transport' ||
          lastError.status === 429 ||
          lastError.status === 503;
        if (!retryable || attempt === H_NOTIFICATION_MAX_ATTEMPTS) break;
        await this.delay(100 * attempt + Math.floor(Math.random() * 50));
      }
    }
    this.logger.error(
      `H 通知失败 event=${trace.eventKind} commentId=${trace.commentId} batch=${trace.batchIndex} error=${lastError?.kind ?? 'unknown'} status=${lastError?.status ?? 'none'}`,
      NotificationClient.name,
    );
    throw lastError ?? new NotificationClientError('transport');
  }

  private baseUrl(): string {
    return this.config
      .get<string>('H_BASE_URL', H_NOTIFICATION_DEFAULT_BASE_URL)
      .replace(/\/$/, '');
  }

  private normalizeError(error: unknown): NotificationClientError {
    if (error instanceof NotificationClientError) return error;
    if (axios.isAxiosError(error)) {
      return error.response
        ? new NotificationClientError('http', error.response.status)
        : new NotificationClientError('transport');
    }
    return new NotificationClientError('transport');
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
