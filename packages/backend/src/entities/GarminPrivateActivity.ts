import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GarminActivityDetailStatus =
  | 'pending'
  | 'complete'
  | 'partial'
  | 'failed';

/** Private Garmin activity index. Never return this entity from public APIs. */
@Entity({ name: 'garmin_private_activity' })
@Index(['sourceActivityId'], { unique: true })
@Index(['startedAtGmt'])
export class GarminPrivateActivityEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  sourceActivityId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  activityUuid: string | null;

  @Column({ type: 'varchar', length: 64 })
  activityType: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  privacyType: string | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  startedAtGmt: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  startedAtLocal: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  sourceUpdatedAt: Date | null;

  @Column({ type: 'datetime', precision: 3 })
  lastSeenAt: Date;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  reconciliationStatus: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'complete', 'partial', 'failed'],
    default: 'pending',
  })
  detailStatus: GarminActivityDetailStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
