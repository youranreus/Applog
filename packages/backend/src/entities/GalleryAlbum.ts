import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GalleryPhotoEntity } from './GalleryPhoto';

@Entity({ name: 'gallery_album' })
@Index('IDX_gallery_album_published_id', ['publishedAt', 'id'])
export class GalleryAlbumEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Index({ unique: true })
  @Column({ type: 'char', length: 36 })
  publicId: string;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  folder: string;
  @Column({ type: 'varchar', length: 191 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'datetime', precision: 3 }) publishedAt: Date;
  @OneToMany(() => GalleryPhotoEntity, (photo) => photo.album)
  photos: GalleryPhotoEntity[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
