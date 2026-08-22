import type { FlomoSyncStatus } from '@applog/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Durable, credential-free state for Flomo sync and publication revision gating. */
@Entity({ name: 'flomo_sync_state' })
export class FlomoSyncStateEntity {
  @PrimaryColumn({ type: 'tinyint', default: 1 })
  id: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  appliedSourceRevision: number | null;

  /** Forces a full, fail-closed refresh when persisted sanitizer output changes. */
  @Column({ type: 'int', unsigned: true, nullable: true })
  normalizerVersion: number | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  latestUpdatedAt: Date | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  latestSlug: string | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastAttemptedAt: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastSuccessfulAt: Date | null;

  @Column({
    type: 'enum',
    enum: ['never_synced', 'syncing', 'healthy', 'degraded', 'reauth_required'],
    default: 'never_synced',
  })
  status: FlomoSyncStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCategory: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  publicMemoCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
