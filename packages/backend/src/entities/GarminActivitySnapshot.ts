import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 只保留公开展示所需字段的 Garmin 活动快照。 */
@Entity({ name: 'garmin_activity_snapshot' })
@Index(['sourceActivityId'], { unique: true })
@Index(['published', 'startedAt'])
export class GarminActivitySnapshotEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64, nullable: false })
  sourceActivityId: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  activityType: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  activityTypeDisplay: string;

  @Column({ type: 'datetime', precision: 3, nullable: false })
  startedAt: Date;

  @Column({ type: 'double', nullable: true })
  distanceMeters: number | null;

  @Column({ type: 'int', unsigned: true, nullable: false })
  durationSeconds: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceSource: string | null;

  @Column({ type: 'text', nullable: true })
  routePathData: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  routeViewBox: string | null;

  @Column({ type: 'boolean', default: false })
  routeProcessed: boolean;

  @Column({ type: 'boolean', default: false })
  published: boolean;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  sourceUpdatedAt: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: false })
  lastSeenAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
