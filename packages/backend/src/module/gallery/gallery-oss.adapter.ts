import { Injectable } from '@nestjs/common';
import OSS from 'ali-oss';
import axios from 'axios';
import { buildGalleryUrl } from '@applog/common';

export interface GalleryOssCredentials {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
}
export const GALLERY_OSS_ADAPTER = Symbol('GALLERY_OSS_ADAPTER');
export interface GalleryOssAdapter {
  list(config: GalleryOssCredentials, prefix: string): Promise<void>;
  put(
    config: GalleryOssCredentials,
    key: string,
    content: Buffer | string,
  ): Promise<void>;
  putFile(
    config: GalleryOssCredentials,
    key: string,
    filePath: string,
    mime: string,
  ): Promise<void>;
  headCdn(cdnDomain: string, key: string): Promise<void>;
  delete(config: GalleryOssCredentials, key: string): Promise<void>;
}

@Injectable()
export class AliyunGalleryOssAdapter implements GalleryOssAdapter {
  private client(config: GalleryOssCredentials): OSS {
    return new OSS({
      endpoint: config.endpoint,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      secure: true,
    });
  }
  async list(config: GalleryOssCredentials, prefix: string): Promise<void> {
    await this.client(config).listV2({ prefix, 'max-keys': 1 });
  }
  async put(
    config: GalleryOssCredentials,
    key: string,
    content: Buffer | string,
  ): Promise<void> {
    await this.client(config).put(key, content);
  }
  async putFile(
    config: GalleryOssCredentials,
    key: string,
    filePath: string,
    mime: string,
  ): Promise<void> {
    await this.client(config).put(key, filePath, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }
  async headCdn(cdnDomain: string, key: string): Promise<void> {
    await axios.head(buildGalleryUrl(cdnDomain, key), {
      timeout: 8000,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }
  async delete(config: GalleryOssCredentials, key: string): Promise<void> {
    await this.client(config).delete(key);
  }
}
