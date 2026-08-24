import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type {
  ICreateGalleryAlbum,
  IUpdateGalleryAlbum,
  IUpdateGalleryPhoto,
} from '@applog/common';

export class SetGalleryConfigDto {
  @IsString() @Length(1, 255) endpoint: string;
  @IsString() @Length(1, 191) bucket: string;
  @IsString() @Length(1, 191) accessKeyId: string;
  @IsString() @IsOptional() accessKeySecret?: string;
  @IsString() @Length(1, 255) cdnDomain: string;
  @IsString() @Length(1, 255) galleryPath: string;
  @IsBoolean() enabled: boolean;
}

export class CreateGalleryAlbumDto implements ICreateGalleryAlbum {
  @IsString() @Matches(/^[a-z0-9][a-z0-9_-]{0,63}$/) folder: string;
  @IsString() @Length(1, 191) title: string;
  @IsString() @Length(0, 5000) @IsOptional() description?: string;
  @IsDateString() @IsOptional() publishedAt?: string;
}

export class UpdateGalleryAlbumDto implements IUpdateGalleryAlbum {
  @IsString() @Length(1, 191) @IsOptional() title?: string;
  @IsString() @Length(0, 5000) @IsOptional() description?: string | null;
  @IsDateString() @IsOptional() publishedAt?: string;
}

export class UpdateGalleryPhotoDto implements IUpdateGalleryPhoto {
  @IsString() @Length(0, 191) @IsOptional() title?: string | null;
  @IsString() @Length(0, 5000) @IsOptional() description?: string | null;
  @IsDateString() @IsOptional() publishedAt?: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) @IsOptional() latitude?:
    | number
    | null;
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number | null;
}

export class GalleryPhotoQueryDto {
  @IsString() @IsOptional() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() limit = 50;
}
