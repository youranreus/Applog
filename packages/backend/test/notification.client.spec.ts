import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import axios from 'axios';
import { NotificationClient } from '../src/module/notification/notification.client';
import type { HTemplateNotificationRequest } from '../src/module/notification/notification.types';

const payload: HTemplateNotificationRequest = {
  recipients: [{ kind: 'email', email: 'private@example.com' }],
  content: {
    kind: 'template',
    templateKey: 'applog-comment-status',
    variables: { commentExcerpt: 'private content' },
  },
  idempotencyKey: 'stable-key',
};

function client(logs: string[]) {
  const instance = new NotificationClient({
    get: (key: string, fallback: string) =>
      key === 'H_BASE_URL' ? 'https://h.example/' : fallback,
  } as never);
  Object.assign(instance, {
    logger: {
      log: (message: string) => logs.push(message),
      error: (message: string) => logs.push(message),
    },
    delay: async () => undefined,
  });
  return instance;
}

describe('NotificationClient', () => {
  it('sends the exact H contract and retries 429 with the same body', async () => {
    const original = axios.post;
    const calls: Array<{ url: string; body: unknown; config: unknown }> = [];
    axios.post = (async (url: string, body: unknown, config: unknown) => {
      calls.push({ url, body, config });
      if (calls.length === 1) {
        const error = new Error('rate limited') as Error & {
          response: object;
          isAxiosError: boolean;
        };
        error.response = { status: 429 };
        error.isAxiosError = true;
        throw error;
      }
      return {
        status: 200,
        data: { code: 0, msg: 'success', data: { notificationId: 'n1' } },
      };
    }) as typeof axios.post;
    try {
      await client([]).send('mail-secret', payload, {
        eventKind: 'comment-status',
        commentId: 1,
        batchIndex: 0,
      });
    } finally {
      axios.post = original;
    }
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://h.example/v1/notifications');
    assert.equal(calls[0].body, payload);
    assert.equal(calls[1].body, payload);
    assert.equal(
      (calls[0].config as { headers: { Authorization: string } }).headers
        .Authorization,
      'NotificationKey mail-secret',
    );
  });

  it('does not retry non-recoverable responses and logs no PII', async () => {
    const original = axios.post;
    let attempts = 0;
    axios.post = (async () => {
      attempts += 1;
      const error = new Error('bad request') as Error & {
        response: object;
        isAxiosError: boolean;
      };
      error.response = { status: 400 };
      error.isAxiosError = true;
      throw error;
    }) as typeof axios.post;
    const logs: string[] = [];
    try {
      await assert.rejects(
        client(logs).send('mail-secret', payload, {
          eventKind: 'comment-status',
          commentId: 1,
          batchIndex: 0,
        }),
      );
    } finally {
      axios.post = original;
    }
    assert.equal(attempts, 1);
    const output = logs.join('\n');
    assert.doesNotMatch(
      output,
      /private@example\.com|private content|mail-secret/,
    );
    assert.match(output, /status=400/);
  });
});
