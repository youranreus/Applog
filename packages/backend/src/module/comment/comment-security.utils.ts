import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Build the public Gravatar URL without exposing the source email separately.
 */
export function gravatarUrl(
  email: string | null | undefined,
): string | undefined {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return undefined;
  const digest = createHash('md5').update(normalized).digest('hex');
  return `https://www.gravatar.com/avatar/${digest}?d=identicon`;
}

export function hashWithdrawToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function matchesWithdrawToken(
  expected: string | null | undefined,
  token: string,
): boolean {
  const actual = hashWithdrawToken(token);
  const normalizedExpected =
    expected?.length === actual.length ? expected : '0'.repeat(actual.length);
  const matches = timingSafeEqual(
    Buffer.from(normalizedExpected),
    Buffer.from(actual),
  );
  return Boolean(expected) && matches;
}
