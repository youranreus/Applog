import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Independent resumable cursor for one Garmin synchronization stream. */
@Entity({ name: 'garmin_sync_stream_state' })
export class GarminSyncStreamStateEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  streamKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cursor: string | null;

  @Column({ type: 'boolean', default: false })
  backfillComplete: boolean;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastAttemptedAt: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastSuccessfulAt: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'never_synced' })
  status: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCategory: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  consecutiveFailureCount: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
