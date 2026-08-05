import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BusinessException } from '@reus-able/nestjs';
import type { ILoginResponseDto } from '../src/module/user/dto';
import { UserController } from '../src/module/user/user.controller';
import type {
  OidcClaims,
  OidcTransaction,
} from '../src/module/user/oidc.service';

const result = {
  token: 'applog-token',
  user: { id: 'opaque', name: 'User' },
} as ILoginResponseDto;

class ReplyDouble {
  headers = new Map<string, string | string[]>();
  redirectUrl?: string;

  header(name: string, value: string | string[]): this {
    this.headers.set(name, value);
    return this;
  }

  redirect(url: string): string {
    this.redirectUrl = url;
    return url;
  }
}

function createController(
  options: { finishError?: Error; completionAge?: number } = {},
) {
  const transaction: OidcTransaction = {
    state: 'state',
    nonce: 'nonce',
    codeVerifier: 'verifier',
    returnPath: '/archives/post.html',
    createdAt: Date.now(),
  };
  let loggedError: unknown;
  const oidc = {
    begin: async (returnPath?: string) => ({
      url: new URL('https://h.example/authorize'),
      transaction: { ...transaction, returnPath: returnPath || '/' },
    }),
    transactionTtl: () => 600_000,
    completionTtl: () => 120_000,
    seal: (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url'),
    open: <T>(value?: string): T | undefined => {
      if (value === 'transaction') return transaction as T;
      if (value === 'completion') {
        return {
          result,
          createdAt: Date.now() - (options.completionAge || 0),
        } as T;
      }
      return undefined;
    },
    cookie: (name: string, value: string, maxAge: number) =>
      `${name}=${value}; Max-Age=${maxAge}`,
    frontUrl: () => 'https://app.example',
    callbackUrl: (rawUrl: string) => new URL(rawUrl, 'https://api.example'),
    finish: async (): Promise<OidcClaims> => {
      if (options.finishError) throw options.finishError;
      return {
        iss: 'https://h.example',
        sub: 'opaque',
        email: 'user@example.com',
        email_verified: true,
      };
    },
    logCallbackFailure: (error: unknown) => {
      loggedError = error;
    },
  };
  const users = { loginWithOidc: async () => result };
  return {
    controller: new UserController(users as never, oidc as never),
    getLoggedError: () => loggedError,
  };
}

describe('UserController OIDC endpoints', () => {
  it('sets a transaction cookie and redirects to authorization', async () => {
    const { controller } = createController();
    const reply = new ReplyDouble();

    await controller.login('/admin', reply);

    assert.match(String(reply.headers.get('Set-Cookie')), /^oidc_tx=/);
    assert.equal(reply.redirectUrl, 'https://h.example/authorize');
  });

  it('clears the transaction and propagates its bound return path after callback', async () => {
    const { controller } = createController();
    const reply = new ReplyDouble();

    await controller.callback(
      {
        headers: { cookie: 'oidc_tx=transaction' },
        raw: { url: '/user/oidc/callback?code=x' },
      },
      reply,
    );

    const cookies = reply.headers.get('Set-Cookie') as string[];
    assert.equal(cookies[0], 'oidc_tx=; Max-Age=0');
    assert.match(cookies[1], /^oidc_completion=/);
    assert.equal(
      reply.redirectUrl,
      'https://app.example/user/callback?returnPath=%2Farchives%2Fpost.html',
    );
  });

  it('returns only a generic callback error and clears the transaction', async () => {
    const failure = new Error('sensitive provider response');
    const { controller, getLoggedError } = createController({
      finishError: failure,
    });
    const reply = new ReplyDouble();

    await controller.callback(
      {
        headers: { cookie: 'oidc_tx=transaction' },
        raw: { url: '/user/oidc/callback?code=secret' },
      },
      reply,
    );

    assert.equal(reply.headers.get('Set-Cookie'), 'oidc_tx=; Max-Age=0');
    assert.equal(
      reply.redirectUrl,
      'https://app.example/user/callback?error=login_failed',
    );
    assert.equal(getLoggedError(), failure);
  });

  it('consumes a completion cookie and rejects a repeated or expired completion', async () => {
    const active = createController().controller;
    const activeReply = new ReplyDouble();
    assert.equal(
      await active.complete(
        { headers: { cookie: 'oidc_completion=completion' }, raw: { url: '' } },
        activeReply,
      ),
      result,
    );
    assert.equal(
      activeReply.headers.get('Set-Cookie'),
      'oidc_completion=; Max-Age=0',
    );

    await assert.rejects(
      active.complete({ headers: {}, raw: { url: '' } }, new ReplyDouble()),
      BusinessException,
    );
    const expired = createController({ completionAge: 120_001 }).controller;
    await assert.rejects(
      expired.complete(
        { headers: { cookie: 'oidc_completion=completion' }, raw: { url: '' } },
        new ReplyDouble(),
      ),
      BusinessException,
    );
  });
});
