import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  SECRET_PURPOSES,
  SecretEncryptionService,
} from '../src/module/secret-encryption/secret-encryption.service';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../docs/security/secret-encryption-vectors.json'),
    'utf8',
  ),
);

test('derivation matches the language-neutral vectors', () => {
  const master = Buffer.from(vectors.masterKeyBase64, 'base64');
  for (const purpose of SECRET_PURPOSES) {
    assert.equal(
      SecretEncryptionService.deriveKey(master, purpose).toString('base64'),
      vectors.derivedKeysBase64[purpose],
    );
  }
});

test('envelopes are random and bound to purpose and record', () => {
  const service = new SecretEncryptionService(
    new ConfigService({ APP_SECRET_ENCRYPTION_KEY: vectors.masterKeyBase64 }),
  );
  const first = service.encrypt('secret', 'flomo.token', 'config:1');
  const second = service.encrypt('secret', 'flomo.token', 'config:1');
  assert.notDeepEqual(first.nonce, second.nonce);
  assert.equal(
    service.decrypt(first, 'flomo.token', 'config:1').toString(),
    'secret',
  );
  assert.throws(() => service.decrypt(first, 'flomo.token', 'config:2'));
  assert.throws(() => service.decrypt(first, 'garmin.credential', 'config:1'));
});

test('master key decoding rejects malformed input', () => {
  for (const value of [
    undefined,
    'not-base64!',
    Buffer.from('short').toString('base64'),
  ]) {
    assert.throws(() => SecretEncryptionService.decodeMasterKey(value));
  }
});
