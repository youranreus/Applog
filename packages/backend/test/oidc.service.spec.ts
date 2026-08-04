import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import type { HLogger } from '@reus-able/nestjs';
import { OidcService } from '../src/module/user/oidc.service';

function service(overrides: Record<string, string> = {}) {
  return new OidcService(
    new ConfigService({
      OIDC_SESSION_SECRET: 'a-secure-session-secret-with-32-bytes',
      OIDC_REDIRECT_URI: 'https://api.example.com/user/oidc/callback',
      FRONT_URL: 'http://localhost:5173',
      ...overrides,
    }),
    { log() {}, warn() {}, error() {} } as unknown as HLogger,
  );
}

describe('OidcService session helpers', () => {
  it('只接受站内 return path', () => {
    const oidc = service();
    assert.equal(
      oidc.normalizeReturnPath('/post/1?tab=comments'),
      '/post/1?tab=comments',
    );
    assert.equal(oidc.normalizeReturnPath('//evil.example'), '/');
    assert.equal(oidc.normalizeReturnPath('https://evil.example'), '/');
    assert.equal(oidc.normalizeReturnPath('/\\evil.example'), '/');
  });

  it('加密会话可恢复且拒绝篡改', () => {
    const oidc = service();
    const sealed = oidc.seal({ state: 'state-value', createdAt: 123 });
    assert.deepEqual(oidc.open(sealed), {
      state: 'state-value',
      createdAt: 123,
    });
    const replacement = sealed[10] === 'A' ? 'B' : 'A';
    const tampered = `${sealed.slice(0, 10)}${replacement}${sealed.slice(11)}`;
    assert.equal(oidc.open(tampered), undefined);
    assert.equal(sealed.includes('state-value'), false);
  });

  it('会话 Cookie 限定 HttpOnly、SameSite 和 TTL', () => {
    const cookie = service().cookie('oidc_tx', 'encrypted', 60_000);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=60/);
  });

  it('回调 URL 使用已登记的 HTTPS 地址并保留 provider 参数', () => {
    const callback = service().callbackUrl(
      '/user/oidc/callback?code=code-value&state=state-value&iss=https%3A%2F%2Fh.exia.xyz%2Foidc',
    );

    assert.equal(callback.origin, 'https://api.example.com');
    assert.equal(callback.pathname, '/user/oidc/callback');
    assert.equal(callback.searchParams.get('code'), 'code-value');
    assert.equal(callback.searchParams.get('state'), 'state-value');
    assert.equal(callback.searchParams.get('iss'), 'https://h.exia.xyz/oidc');
  });

  it('生产环境 Cookie 强制 Secure', () => {
    const cookie = service({ NODE_ENV: 'production' }).cookie(
      'oidc_tx',
      'encrypted',
      60_000,
    );

    assert.match(cookie, /; Secure$/);
  });

  it('启动时拒绝生产环境 HTTP callback', () => {
    assert.throws(
      () =>
        service({
          NODE_ENV: 'production',
          OIDC_ISSUER: 'https://h.exia.xyz/oidc',
          OIDC_CLIENT_ID: 'client-id',
          OIDC_REDIRECT_URI: 'http://api.example.com/user/oidc/callback',
        }).onModuleInit(),
      /must use HTTPS/,
    );
  });
});
