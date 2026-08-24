import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GalleryPhotoStorageState, IGalleryExif } from '@applog/common';
import { GalleryAlbumEntity } from './GalleryAlbum';

@Entity({ name: 'gallery_photo' })
@Index('IDX_gallery_photo_album_published_id', ['albumId', 'publishedAt', 'id'])
export class GalleryPhotoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Index({ unique: true })
  @Column({ type: 'char', length: 36 })
  publicId: string;
  @Column({ type: 'bigint' }) albumId: string;
  @ManyToOne(() => GalleryAlbumEntity, (album) => album.photos, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'albumId' })
  album: GalleryAlbumEntity;
  @Column({ type: 'varchar', length: 512 }) sourceObjectKey: string;
  @Column({ type: 'varchar', length: 512 }) displayObjectKey: string;
  @Column({ type: 'varchar', length: 64 }) sourceMime: string;
  @Column({ type: 'varchar', length: 64 }) displayMime: string;
  @Column({ type: 'bigint', unsigned: true }) byteSize: string;
  @Column({ type: 'int', unsigned: true }) width: number;
  @Column({ type: 'int', unsigned: true }) height: number;
  @Column({ type: 'varchar', length: 191, nullable: true }) originalFilename:
    | string
    | null;
  @Column({ type: 'varchar', length: 32, default: 'ready' })
  storageState: GalleryPhotoStorageState;
  @Column({ type: 'varchar', length: 191, nullable: true }) title:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'datetime', precision: 3, nullable: true })
  takenAt: Date | null;
  @Column({ type: 'datetime', precision: 3 }) publishedAt: Date;
  @Column({ type: 'double', nullable: true }) latitude: number | null;
  @Column({ type: 'double', nullable: true }) longitude: number | null;
  @Column({ type: 'json', nullable: true }) exif: IGalleryExif | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
