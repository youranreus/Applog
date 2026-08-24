import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GalleryAlbumEntity,
  GalleryConfigEntity,
  GalleryPhotoEntity,
} from '@/entities';
import { SecretEncryptionModule } from '@/module/secret-encryption/secret-encryption.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import {
  AliyunGalleryOssAdapter,
  GALLERY_OSS_ADAPTER,
} from './gallery-oss.adapter';
import { GalleryImageProcessor } from './gallery-image.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GalleryConfigEntity,
      GalleryAlbumEntity,
      GalleryPhotoEntity,
    ]),
    SecretEncryptionModule,
  ],
  controllers: [GalleryController],
  providers: [
    GalleryService,
    GalleryImageProcessor,
    AliyunGalleryOssAdapter,
    { provide: GALLERY_OSS_ADAPTER, useExisting: AliyunGalleryOssAdapter },
  ],
  exports: [GalleryService],
})
export class GalleryModule {}
