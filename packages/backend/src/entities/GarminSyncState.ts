import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GarminSyncStatus =
  | 'never_synced'
  | 'healthy'
  | 'degraded'
  | 'reauth_required';

/** Garmin worker 的无敏感信息同步状态。 */
@Entity({ name: 'garmin_sync_state' })
export class GarminSyncStateEntity {
  @PrimaryColumn({ type: 'tinyint', default: 1 })
  id: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  totalActivityCount: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  backfillCursor: string | null;

  @Column({ type: 'boolean', default: false })
  backfillComplete: boolean;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastAttemptedAt: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastSuccessfulAt: Date | null;

  @Column({
    type: 'enum',
    enum: ['never_synced', 'healthy', 'degraded', 'reauth_required'],
    default: 'never_synced',
  })
  status: GarminSyncStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCategory: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
