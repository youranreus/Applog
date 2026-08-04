import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretPost,
  discovery,
  None,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  type Configuration,
} from 'openid-client';

const TRANSACTION_TTL = 10 * 60 * 1000;
const COMPLETION_TTL = 2 * 60 * 1000;

export type OidcClaims = {
  iss: string;
  sub: string;
  email: string;
  email_verified: true;
  nickname?: string;
  picture?: string;
};

export type OidcTransaction = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnPath: string;
  createdAt: number;
};

@Injectable()
export class OidcService implements OnModuleInit {
  private configuration?: Promise<Configuration>;

  constructor(
    private readonly config: ConfigService,
    @Inject(HLOGGER_TOKEN) private readonly logger: HLogger,
  ) {}

  onModuleInit(): void {
    new URL(this.required('OIDC_ISSUER'));
    const redirectUri = new URL(this.required('OIDC_REDIRECT_URI'));
    new URL(this.frontUrl());
    this.required('OIDC_CLIENT_ID');
    this.sessionSecret();
    if (
      this.config.get('NODE_ENV') === 'production' &&
      redirectUri.protocol !== 'https:'
    ) {
      throw new Error('OIDC_REDIRECT_URI must use HTTPS in production');
    }
  }

  private required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) throw new Error(`Missing OIDC configuration: ${name}`);
    return value;
  }

  private sessionSecret(): string {
    const secret = this.required('OIDC_SESSION_SECRET');
    if (Buffer.byteLength(secret) < 32)
      throw new Error('OIDC_SESSION_SECRET must be at least 32 bytes');
    return secret;
  }

  frontUrl(): string {
    return this.required('FRONT_URL').replace(/\/$/, '');
  }

  private client(): Promise<Configuration> {
    if (!this.configuration) {
      const issuer = new URL(this.required('OIDC_ISSUER'));
      const id = this.required('OIDC_CLIENT_ID');
      const secret = this.config.get<string>('OIDC_CLIENT_SECRET');
      this.configuration = discovery(
        issuer,
        id,
        undefined,
        secret ? ClientSecretPost(secret) : None(),
      );
    }
    return this.configuration;
  }

  normalizeReturnPath(value?: string): string {
    return value?.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\')
      ? value
      : '/';
  }

  async begin(
    returnPath?: string,
  ): Promise<{ url: URL; transaction: OidcTransaction }> {
    const configuration = await this.client();
    const codeVerifier = randomPKCECodeVerifier();
    const transaction: OidcTransaction = {
      state: randomState(),
      nonce: randomNonce(),
      codeVerifier,
      returnPath: this.normalizeReturnPath(returnPath),
      createdAt: Date.now(),
    };
    const url = buildAuthorizationUrl(configuration, {
      redirect_uri: this.required('OIDC_REDIRECT_URI'),
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: await calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state: transaction.state,
      nonce: transaction.nonce,
    });
    return { url, transaction };
  }

  async finish(
    callbackUrl: URL,
    transaction: OidcTransaction,
  ): Promise<OidcClaims> {
    if (Date.now() - transaction.createdAt > TRANSACTION_TTL)
      throw new Error('expired_transaction');
    const tokens = await authorizationCodeGrant(
      await this.client(),
      callbackUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        idTokenExpected: true,
      },
    );
    const claims = tokens.claims() as unknown as OidcClaims | undefined;
    if (
      !claims?.iss ||
      !claims.sub ||
      !claims.email ||
      claims.email_verified !== true
    )
      throw new Error('invalid_identity');
    return claims;
  }

  callbackUrl(rawUrl: string): URL {
    const configured = new URL(this.required('OIDC_REDIRECT_URI'));
    const requestUrl = new URL(rawUrl, configured);
    configured.search = requestUrl.search;
    return configured;
  }

  logCallbackFailure(error: unknown): void {
    const category = error instanceof Error ? error.name : 'UnknownError';
    this.logger.warn(`OIDC 回调失败，错误分类: ${category}`, OidcService.name);
  }

  seal(value: object): string {
    const key = createHash('sha256').update(this.sessionSecret()).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value)),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64url',
    );
  }

  open<T>(value?: string): T | undefined {
    if (!value) return undefined;
    try {
      const data = Buffer.from(value, 'base64url');
      const key = createHash('sha256').update(this.sessionSecret()).digest();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        data.subarray(0, 12),
      );
      decipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(data.subarray(28)),
          decipher.final(),
        ]).toString(),
      );
    } catch {
      return undefined;
    }
  }

  cookie(name: string, value: string, maxAge: number): string {
    const secure =
      this.config.get('NODE_ENV') === 'production' ? '; Secure' : '';
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`;
  }

  transactionTtl() {
    return TRANSACTION_TTL;
  }
  completionTtl() {
    return COMPLETION_TTL;
  }
}
