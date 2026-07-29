import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Public static cover bytes. Coordinates and source metadata are forbidden. */
@Entity({ name: 'garmin_activity_cover' })
@Index(['coverId'], { unique: true })
@Index(['privateActivityId'], { unique: true })
export class GarminActivityCoverEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  coverId: string;

  @Column({ type: 'bigint' })
  privateActivityId: string;

  @Column({ type: 'longblob' })
  imageData: Buffer;

  @Column({ type: 'varchar', length: 32, default: 'image/webp' })
  contentType: string;

  @Column({ type: 'smallint', unsigned: true })
  width: number;

  @Column({ type: 'smallint', unsigned: true })
  height: number;

  @Column({ type: 'int', unsigned: true })
  byteSize: number;

  @Column({ type: 'char', length: 64 })
  etag: string;

  @Column({ type: 'varchar', length: 64 })
  provider: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  attribution: string | null;

  @Column({ type: 'varchar', length: 64 })
  renderVersion: string;

  @Column({ type: 'datetime', precision: 3 })
  generatedAt: Date;
}
