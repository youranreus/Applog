import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Queryable private normalized activity detail. */
@Entity({ name: 'garmin_activity_detail' })
@Index(['privateActivityId'], { unique: true })
export class GarminActivityDetailEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  privateActivityId: string;

  @Column({ type: 'double', nullable: true })
  movingDurationSeconds: number | null;

  @Column({ type: 'double', nullable: true })
  averageSpeedMetersPerSecond: number | null;

  @Column({ type: 'double', nullable: true })
  maxSpeedMetersPerSecond: number | null;

  @Column({ type: 'double', nullable: true })
  averageHeartRateBpm: number | null;

  @Column({ type: 'double', nullable: true })
  maxHeartRateBpm: number | null;

  @Column({ type: 'double', nullable: true })
  elevationGainMeters: number | null;

  @Column({ type: 'double', nullable: true })
  averageCadencePerMinute: number | null;

  @Column({ type: 'double', nullable: true })
  averagePowerWatts: number | null;

  @Column({ type: 'double', nullable: true })
  trainingEffect: number | null;

  @Column({ type: 'double', nullable: true })
  bodyBatteryDelta: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  lapCount: number | null;

  @Column({ type: 'json', nullable: true })
  splitData: unknown[] | null;
}
