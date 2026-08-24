import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthRoles, BusinessException } from '@reus-able/nestjs';
import type { MultipartFile } from '@fastify/multipart';
import type {
  IGalleryAdminConfig,
  IGalleryAlbumSummary,
  IGalleryPhotoDetail,
  IGalleryPhotoPage,
  IGalleryStatus,
} from '@applog/common';
import {
  CreateGalleryAlbumDto,
  GalleryPhotoQueryDto,
  SetGalleryConfigDto,
  UpdateGalleryAlbumDto,
  UpdateGalleryPhotoDto,
} from './dto/gallery.dto';
import { GalleryService } from './gallery.service';

@Controller({ path: 'gallery', version: [VERSION_NEUTRAL, '1'] })
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}
  @Get('status') getStatus(): Promise<IGalleryStatus> {
    return this.gallery.getStatus();
  }
  @Get('albums') getAlbums(): Promise<IGalleryAlbumSummary[]> {
    return this.gallery.getAlbums();
  }
  @Get('albums/:publicId/photos') getPhotos(
    @Param('publicId') id: string,
    @Query() query: GalleryPhotoQueryDto,
  ): Promise<IGalleryPhotoPage> {
    return this.gallery.getPhotos(id, query);
  }
  @Get('photos/:publicId') getPhoto(
    @Param('publicId') id: string,
  ): Promise<IGalleryPhotoDetail> {
    return this.gallery.getPhoto(id);
  }

  @Get('admin/config')
  @AuthRoles('admin')
  getConfig(): Promise<IGalleryAdminConfig> {
    return this.gallery.getAdminConfig();
  }
  @Put('admin/config') @AuthRoles('admin') setConfig(
    @Body() dto: SetGalleryConfigDto,
  ): Promise<IGalleryAdminConfig> {
    return this.gallery.setConfig(dto);
  }
  @Post('admin/config/test')
  @AuthRoles('admin')
  testConfig(): Promise<IGalleryAdminConfig> {
    return this.gallery.testConfig();
  }
  @Get('admin/albums') @AuthRoles('admin') getAdminAlbums(): Promise<
    IGalleryAlbumSummary[]
  > {
    return this.gallery.getAlbums(true);
  }
  @Post('admin/albums') @AuthRoles('admin') createAlbum(
    @Body() dto: CreateGalleryAlbumDto,
  ): Promise<IGalleryAlbumSummary> {
    return this.gallery.createAlbum(dto);
  }
  @Patch('admin/albums/:publicId') @AuthRoles('admin') updateAlbum(
    @Param('publicId') id: string,
    @Body() dto: UpdateGalleryAlbumDto,
  ): Promise<IGalleryAlbumSummary> {
    return this.gallery.updateAlbum(id, dto);
  }
  @Delete('admin/albums/:publicId') @AuthRoles('admin') deleteAlbum(
    @Param('publicId') id: string,
  ): Promise<void> {
    return this.gallery.deleteAlbum(id);
  }
  @Get('admin/albums/:publicId/photos') @AuthRoles('admin') getAdminPhotos(
    @Param('publicId') id: string,
    @Query() query: GalleryPhotoQueryDto,
  ): Promise<IGalleryPhotoPage> {
    return this.gallery.getPhotos(id, query, true);
  }
  @Post('admin/albums/:publicId/photos') @AuthRoles('admin') async upload(
    @Param('publicId') id: string,
    @Req() request: { file: () => Promise<MultipartFile | undefined> },
  ): Promise<IGalleryPhotoDetail> {
    const file = await request.file();
    if (!file) throw new BusinessException('请选择图片文件');
    return this.gallery.upload(id, file);
  }
  @Get('admin/photos/:publicId') @AuthRoles('admin') getAdminPhoto(
    @Param('publicId') id: string,
  ): Promise<IGalleryPhotoDetail> {
    return this.gallery.getPhoto(id, true);
  }
  @Patch('admin/photos/:publicId') @AuthRoles('admin') updatePhoto(
    @Param('publicId') id: string,
    @Body() dto: UpdateGalleryPhotoDto,
  ): Promise<IGalleryPhotoDetail> {
    return this.gallery.updatePhoto(id, dto);
  }
  @Delete('admin/photos/:publicId') @AuthRoles('admin') deletePhoto(
    @Param('publicId') id: string,
  ): Promise<void> {
    return this.gallery.deletePhoto(id);
  }
}
