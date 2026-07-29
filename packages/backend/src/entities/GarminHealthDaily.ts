import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Private daily health summary keyed by Garmin local calendar date. */
@Entity({ name: 'garmin_health_daily' })
@Index(['calendarDate'], { unique: true })
export class GarminHealthDailyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'date' })
  calendarDate: string;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  localBoundaryStart: Date | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  gmtBoundaryStart: Date | null;

  @Column({ type: 'json', nullable: true })
  summaryData: Record<string, number | null> | null;

  @Column({ type: 'json', nullable: true })
  domainStatus: Record<string, string> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
