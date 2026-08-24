import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gallery_config' })
export class GalleryConfigEntity {
  @PrimaryColumn({ type: 'tinyint', default: 1 }) id: number;
  @Column({ type: 'varchar', length: 255, default: '' }) endpoint: string;
  @Column({ type: 'varchar', length: 191, default: '' }) bucket: string;
  @Column({ type: 'varchar', length: 191, default: '' }) accessKeyId: string;
  @Column({ type: 'longblob', nullable: true }) secretCiphertext: Buffer | null;
  @Column({ type: 'varbinary', length: 12, nullable: true })
  secretNonce: Buffer | null;
  @Column({ type: 'varbinary', length: 16, nullable: true })
  secretAuthTag: Buffer | null;
  @Column({ type: 'smallint', unsigned: true, nullable: true })
  secretEnvelopeVersion: number | null;
  @Column({ type: 'smallint', unsigned: true, nullable: true })
  secretKeyVersion: number | null;
  @Column({ type: 'varchar', length: 255, default: '' }) cdnDomain: string;
  @Column({ type: 'varchar', length: 255, default: '' }) galleryPath: string;
  @Column({ type: 'boolean', default: false }) enabled: boolean;
  @Column({ type: 'int', unsigned: true, default: 1 }) configRevision: number;
  @Column({ type: 'int', unsigned: true, nullable: true }) verifiedRevision:
    | number
    | null;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  verifiedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
