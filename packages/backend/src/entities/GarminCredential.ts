import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 加密 Garmin token 的单例信封；密钥不进入数据库。 */
@Entity({ name: 'garmin_credential' })
export class GarminCredentialEntity {
  @PrimaryColumn({ type: 'tinyint', default: 1 })
  id: number;

  @Column({ type: 'longblob', nullable: false })
  ciphertext: Buffer;

  @Column({ type: 'varbinary', length: 12, nullable: false })
  nonce: Buffer;

  @Column({ type: 'varbinary', length: 16, nullable: false })
  authTag: Buffer;

  @Column({ type: 'smallint', unsigned: true, default: 1 })
  encryptionVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
