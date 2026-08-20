import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';

export const SECRET_PURPOSES = [
  'garmin.credential',
  'garmin.private-payload',
  'flomo.token',
] as const;
export type SecretPurpose = (typeof SECRET_PURPOSES)[number];

export interface SecretEnvelope {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  envelopeVersion: 2;
  keyVersion: 1;
}

const SALT = Buffer.from('applog:secret-encryption:v1');

/** Server-only authenticated encryption for persistent application secrets. */
@Injectable()
export class SecretEncryptionService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    this.masterKey = SecretEncryptionService.decodeMasterKey(
      config.get<string>('APP_SECRET_ENCRYPTION_KEY'),
    );
  }

  static decodeMasterKey(encoded: string | undefined): Buffer {
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new Error('APP_SECRET_ENCRYPTION_KEY must be valid base64');
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new Error('APP_SECRET_ENCRYPTION_KEY must decode to 32 bytes');
    }
    return key;
  }

  static deriveKey(masterKey: Buffer, purpose: SecretPurpose): Buffer {
    if (masterKey.length !== 32 || !SECRET_PURPOSES.includes(purpose)) {
      throw new Error('invalid application encryption key or purpose');
    }
    return Buffer.from(
      hkdfSync(
        'sha256',
        masterKey,
        SALT,
        Buffer.from(`applog:${purpose}:key:v1`),
        32,
      ),
    );
  }

  encrypt(
    plaintext: Buffer | string,
    purpose: SecretPurpose,
    recordIdentity: string,
  ): SecretEnvelope {
    const nonce = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      SecretEncryptionService.deriveKey(this.masterKey, purpose),
      nonce,
    );
    cipher.setAAD(this.aad(purpose, recordIdentity));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return {
      ciphertext,
      nonce,
      authTag: cipher.getAuthTag(),
      envelopeVersion: 2,
      keyVersion: 1,
    };
  }

  decrypt(
    envelope: SecretEnvelope,
    purpose: SecretPurpose,
    recordIdentity: string,
  ): Buffer {
    if (envelope.envelopeVersion !== 2 || envelope.keyVersion !== 1) {
      throw new Error('unsupported secret envelope version');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      SecretEncryptionService.deriveKey(this.masterKey, purpose),
      envelope.nonce,
    );
    decipher.setAAD(this.aad(purpose, recordIdentity));
    decipher.setAuthTag(envelope.authTag);
    return Buffer.concat([
      decipher.update(envelope.ciphertext),
      decipher.final(),
    ]);
  }

  private aad(purpose: SecretPurpose, recordIdentity: string): Buffer {
    return Buffer.from(
      JSON.stringify(['applog-secret', purpose, recordIdentity, 2, 1]),
    );
  }
}
