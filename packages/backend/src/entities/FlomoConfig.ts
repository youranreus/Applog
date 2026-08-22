import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Singleton Flomo publication policy and encrypted bearer token. */
@Entity({ name: 'flomo_config' })
export class FlomoConfigEntity {
  @PrimaryColumn({ type: 'tinyint', default: 1 })
  id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'json' })
  publicationTags: string[];

  @Column({ type: 'int', unsigned: true, default: 0 })
  sourceRevision: number;

  @Column({ type: 'longblob', nullable: true })
  tokenCiphertext: Buffer | null;

  @Column({ type: 'varbinary', length: 12, nullable: true })
  tokenNonce: Buffer | null;

  @Column({ type: 'varbinary', length: 16, nullable: true })
  tokenAuthTag: Buffer | null;

  @Column({ type: 'smallint', unsigned: true, nullable: true })
  tokenEnvelopeVersion: number | null;

  @Column({ type: 'smallint', unsigned: true, nullable: true })
  tokenKeyVersion: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
