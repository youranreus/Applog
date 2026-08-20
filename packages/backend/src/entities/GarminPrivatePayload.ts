import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Authenticated encrypted Garmin source payload. */
@Entity({ name: 'garmin_private_payload' })
@Index(['domain', 'ownerKey', 'payloadKind'], { unique: true })
export class GarminPrivatePayloadEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  domain: string;

  @Column({ type: 'varchar', length: 128 })
  ownerKey: string;

  @Column({ type: 'varchar', length: 64 })
  payloadKind: string;

  @Column({ type: 'varchar', length: 64 })
  contentType: string;

  @Column({ type: 'varchar', length: 16 })
  compression: string;

  @Column({ type: 'longblob' })
  ciphertext: Buffer;

  @Column({ type: 'binary', length: 12 })
  nonce: Buffer;

  @Column({ type: 'binary', length: 16 })
  authTag: Buffer;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  encryptionVersion: number;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  keyVersion: number;

  @Column({ type: 'char', length: 64 })
  contentHash: string;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  sourceUpdatedAt: Date | null;

  @Column({ type: 'datetime', precision: 3 })
  fetchedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
