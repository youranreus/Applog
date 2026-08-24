import { Injectable } from '@nestjs/common';
import { readFile, writeFile } from 'fs/promises';
import sharp from 'sharp';
import * as exifr from 'exifr';
import convertHeic from 'heic-convert';
import type { IGalleryExif } from '@applog/common';

export interface GalleryImageMetadata {
  sourceMime: string;
  displayMime: string;
  extension: string;
  width: number;
  height: number;
  takenAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  exif: IGalleryExif | null;
  displayPath: string;
}

@Injectable()
export class GalleryImageProcessor {
  async inspect(
    sourcePath: string,
    declaredMime: string,
    displayPath: string,
  ): Promise<GalleryImageMetadata> {
    const bytes = await readFile(sourcePath);
    const detected = this.detect(bytes);
    if (!detected || !this.mimeMatches(declaredMime, detected.mime))
      throw new Error('文件内容与支持的图片格式不匹配');
    let raw: Record<string, unknown> = {};
    try {
      raw =
        (await exifr.parse(bytes, { gps: true, tiff: true, exif: true })) || {};
    } catch {
      raw = {};
    }
    const image = sharp(sourcePath, { failOn: 'error' }).rotate();
    if (detected.extension === 'heic') {
      try {
        await image.jpeg({ quality: 90, mozjpeg: true }).toFile(displayPath);
      } catch {
        try {
          const jpeg = await convertHeic({
            buffer: bytes,
            format: 'JPEG',
            quality: 0.9,
          });
          await writeFile(displayPath, jpeg);
        } catch {
          throw new Error(
            'HEIC 解码失败，请运行 gallery:doctor 检查真实文件兼容性',
          );
        }
      }
    }
    const metadata = await (
      detected.extension === 'heic' ? sharp(displayPath) : sharp(sourcePath)
    ).metadata();
    if (!metadata.width || !metadata.height)
      throw new Error('无法读取图片尺寸');
    const parsedLatitude = this.coordinate(raw.latitude, -90, 90);
    const parsedLongitude = this.coordinate(raw.longitude, -180, 180);
    // 不持久化半组 GPS，避免详情页和编辑接口出现无法表达的位置状态。
    const hasGps = parsedLatitude !== null && parsedLongitude !== null;
    const latitude = hasGps ? parsedLatitude : null;
    const longitude = hasGps ? parsedLongitude : null;
    const takenAtValue =
      raw.DateTimeOriginal ?? raw.CreateDate ?? raw.ModifyDate;
    const takenAt =
      takenAtValue instanceof Date && !Number.isNaN(takenAtValue.getTime())
        ? takenAtValue
        : null;
    const exif: IGalleryExif = {};
    this.copyString(exif, 'make', raw.Make);
    this.copyString(exif, 'model', raw.Model);
    this.copyString(exif, 'lensModel', raw.LensModel);
    this.copyNumber(exif, 'focalLength', raw.FocalLength);
    this.copyNumber(exif, 'aperture', raw.FNumber);
    this.copyNumber(exif, 'exposureTime', raw.ExposureTime);
    this.copyNumber(exif, 'iso', raw.ISO);
    this.copyNumber(exif, 'exposureBias', raw.ExposureCompensation);
    this.copyNumber(exif, 'orientation', raw.Orientation);
    return {
      sourceMime: detected.mime,
      displayMime: detected.extension === 'heic' ? 'image/jpeg' : detected.mime,
      extension: detected.extension === 'heic' ? 'jpg' : detected.extension,
      width: metadata.autoOrient.width,
      height: metadata.autoOrient.height,
      takenAt,
      latitude,
      longitude,
      exif: Object.keys(exif).length ? exif : null,
      displayPath: detected.extension === 'heic' ? displayPath : sourcePath,
    };
  }
  private detect(bytes: Buffer): { mime: string; extension: string } | null {
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
      return { mime: 'image/jpeg', extension: 'jpg' };
    if (
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
      return { mime: 'image/png', extension: 'png' };
    if (
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    )
      return { mime: 'image/webp', extension: 'webp' };
    const brand = bytes.toString('ascii', 8, 12).toLowerCase();
    if (
      bytes.toString('ascii', 4, 8) === 'ftyp' &&
      ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)
    )
      return { mime: 'image/heic', extension: 'heic' };
    return null;
  }
  private mimeMatches(declared: string, actual: string): boolean {
    return (
      declared === actual ||
      (actual === 'image/heic' && declared === 'image/heif')
    );
  }
  private coordinate(value: unknown, min: number, max: number): number | null {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
      ? value
      : null;
  }
  private copyString(
    target: IGalleryExif,
    key: keyof IGalleryExif,
    value: unknown,
  ): void {
    if (typeof value === 'string' && value.trim())
      (target as Record<string, unknown>)[key] = value.slice(0, 191);
  }
  private copyNumber(
    target: IGalleryExif,
    key: keyof IGalleryExif,
    value: unknown,
  ): void {
    if (typeof value === 'number' && Number.isFinite(value))
      (target as Record<string, unknown>)[key] = value;
  }
}
