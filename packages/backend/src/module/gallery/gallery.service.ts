import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { Brackets, Repository } from 'typeorm';
import {
  buildGalleryObjectKey,
  buildGalleryUrl,
  GALLERY_MAX_FILE_SIZE,
  GALLERY_SECRET_MASK,
  normalizeCdnDomain,
  normalizeGalleryPath,
  type IGalleryAdminConfig,
  type IGalleryAlbumSummary,
  type IGalleryPhotoDetail,
  type IGalleryPhotoPage,
  type IGalleryPhotoSummary,
  type IGalleryStatus,
} from '@applog/common';
import {
  GalleryAlbumEntity,
  GalleryConfigEntity,
  GalleryPhotoEntity,
} from '@/entities';
import { SecretEncryptionService } from '@/module/secret-encryption/secret-encryption.service';
import {
  CreateGalleryAlbumDto,
  GalleryPhotoQueryDto,
  SetGalleryConfigDto,
  UpdateGalleryAlbumDto,
  UpdateGalleryPhotoDto,
} from './dto/gallery.dto';
import {
  GALLERY_OSS_ADAPTER,
  type GalleryOssAdapter,
  type GalleryOssCredentials,
} from './gallery-oss.adapter';
import { GalleryImageProcessor } from './gallery-image.processor';

@Injectable()
export class GalleryService {
  @Inject(HLOGGER_TOKEN) private logger: HLogger;
  constructor(
    @InjectRepository(GalleryConfigEntity)
    private readonly configs: Repository<GalleryConfigEntity>,
    @InjectRepository(GalleryAlbumEntity)
    private readonly albums: Repository<GalleryAlbumEntity>,
    @InjectRepository(GalleryPhotoEntity)
    private readonly photos: Repository<GalleryPhotoEntity>,
    private readonly encryption: SecretEncryptionService,
    private readonly images: GalleryImageProcessor,
    @Inject(GALLERY_OSS_ADAPTER) private readonly oss: GalleryOssAdapter,
  ) {}

  async getStatus(): Promise<IGalleryStatus> {
    const config = await this.configs.findOneBy({ id: 1 });
    return {
      enabled:
        !!config?.enabled &&
        this.isVerified(config) &&
        this.isConfigComplete(config),
    };
  }

  async getAdminConfig(): Promise<IGalleryAdminConfig> {
    return this.maskConfig(await this.getOrCreateConfig());
  }

  async setConfig(dto: SetGalleryConfigDto): Promise<IGalleryAdminConfig> {
    const config = await this.getOrCreateConfig();
    let cdnDomain: string;
    let galleryPath: string;
    const endpointValue = dto.endpoint.trim().replace(/\/+$/, '');
    const endpoint = endpointValue.startsWith('https://')
      ? endpointValue
      : `https://${endpointValue}`;
    const bucket = dto.bucket.trim();
    if (!/^https:\/\/[a-z0-9.-]+\.aliyuncs\.com$/i.test(endpoint)) {
      throw new BusinessException(
        'OSS Endpoint 必须是阿里云 aliyuncs.com 地址',
      );
    }
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
      throw new BusinessException('OSS Bucket 名称格式不正确');
    }
    try {
      cdnDomain = normalizeCdnDomain(dto.cdnDomain);
      galleryPath = normalizeGalleryPath(dto.galleryPath);
    } catch {
      throw new BusinessException('CDN 域名或相册目录格式不正确');
    }
    const nextSecret = dto.accessKeySecret?.trim();
    const hasNewSecret = !!nextSecret && nextSecret !== GALLERY_SECRET_MASK;
    const changed =
      config.endpoint !== endpoint ||
      config.bucket !== bucket ||
      config.accessKeyId !== dto.accessKeyId.trim() ||
      config.cdnDomain !== cdnDomain ||
      config.galleryPath !== galleryPath ||
      hasNewSecret;
    if (hasNewSecret) {
      const envelope = this.encryption.encrypt(
        nextSecret,
        'gallery.oss-credential',
        'gallery-config:1',
      );
      config.secretCiphertext = envelope.ciphertext;
      config.secretNonce = envelope.nonce;
      config.secretAuthTag = envelope.authTag;
      config.secretEnvelopeVersion = envelope.envelopeVersion;
      config.secretKeyVersion = envelope.keyVersion;
    }
    config.endpoint = endpoint;
    config.bucket = bucket;
    config.accessKeyId = dto.accessKeyId.trim();
    config.cdnDomain = cdnDomain;
    config.galleryPath = galleryPath;
    if (changed) {
      config.configRevision += 1;
      config.verifiedRevision = null;
      config.verifiedAt = null;
      config.enabled = false;
    } else if (dto.enabled !== config.enabled) {
      if (dto.enabled && !this.isVerified(config))
        throw new BusinessException('请先保存配置并通过连接测试');
      config.enabled = dto.enabled;
    }
    if (dto.enabled && changed) config.enabled = false;
    return this.maskConfig(await this.configs.save(config));
  }

  async testConfig(): Promise<IGalleryAdminConfig> {
    const config = await this.getOrCreateConfig();
    const testedRevision = config.configRevision;
    const credentials = this.credentials(config);
    if (!credentials || !config.cdnDomain || !config.galleryPath)
      throw new BusinessException('请先完整保存 OSS、CDN 和相册目录配置');
    const probeKey = `${config.galleryPath}/.applog-probe`;
    let cleanupRequired = false;
    let cleanupOk = true;
    let testError: unknown;
    try {
      await this.oss.list(credentials, `${config.galleryPath}/`);
      await this.oss.delete(credentials, probeKey);
      cleanupRequired = true;
      await this.oss.put(
        credentials,
        probeKey,
        Buffer.from('applog-gallery-probe'),
      );
      await this.oss.headCdn(config.cdnDomain, probeKey);
    } catch (error) {
      this.logger.warn(
        `相册 OSS 连接测试失败: ${error instanceof Error ? error.name : 'unknown'}`,
        GalleryService.name,
      );
      testError = error;
    } finally {
      if (cleanupRequired) {
        try {
          await this.oss.delete(credentials, probeKey);
        } catch {
          cleanupOk = false;
          this.logger.warn(
            `相册连接探针清理失败: key=${probeKey}`,
            GalleryService.name,
          );
        }
      }
    }
    if (testError)
      throw new BusinessException(
        '连接测试失败，请检查 OSS 权限、CDN 回源和目录配置',
      );
    if (!cleanupOk)
      throw new BusinessException(
        '连接成功，但测试对象清理失败，请检查删除权限',
      );
    const verifiedAt = new Date();
    const result = await this.configs.update(
      { id: 1, configRevision: testedRevision },
      { verifiedRevision: testedRevision, verifiedAt },
    );
    if (result.affected !== 1)
      throw new BusinessException('配置已变化，请重新测试连接');
    return this.maskConfig(await this.getOrCreateConfig());
  }

  async getAlbums(admin = false): Promise<IGalleryAlbumSummary[]> {
    const config = await this.requireEnabled();
    const rows = await this.albums
      .createQueryBuilder('album')
      .loadRelationCountAndMap(
        'album.photoCount',
        'album.photos',
        'photo',
        (qb) =>
          admin
            ? qb
            : qb.andWhere('photo.storageState = :ready', { ready: 'ready' }),
      )
      .orderBy('album.publishedAt', 'ASC')
      .addOrderBy('album.id', 'ASC')
      .getMany();
    const result: IGalleryAlbumSummary[] = [];
    for (const album of rows) {
      const count = Number(
        (album as GalleryAlbumEntity & { photoCount: number }).photoCount || 0,
      );
      if (!admin && count === 0) continue;
      const cover = await this.photos.findOne({
        where: { albumId: album.id, storageState: 'ready' },
        order: { publishedAt: 'ASC', id: 'ASC' },
      });
      result.push({
        id: album.publicId,
        folder: album.folder,
        title: album.title,
        description: album.description,
        publishedAt: album.publishedAt.toISOString(),
        photoCount: count,
        coverUrl: cover
          ? buildGalleryUrl(config.cdnDomain, cover.displayObjectKey)
          : null,
      });
    }
    return result;
  }

  async createAlbum(dto: CreateGalleryAlbumDto): Promise<IGalleryAlbumSummary> {
    await this.requireEnabled();
    const existing = await this.albums.findOneBy({ folder: dto.folder });
    if (existing) throw new BusinessException('相册目录已存在');
    const album = await this.albums.save(
      this.albums.create({
        publicId: randomUUID(),
        folder: dto.folder,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
      }),
    );
    return {
      id: album.publicId,
      folder: album.folder,
      title: album.title,
      description: album.description,
      publishedAt: album.publishedAt.toISOString(),
      photoCount: 0,
      coverUrl: null,
    };
  }

  async updateAlbum(
    publicId: string,
    dto: UpdateGalleryAlbumDto,
  ): Promise<IGalleryAlbumSummary> {
    const config = await this.requireEnabled();
    const album = await this.album(publicId);
    if (dto.title !== undefined) album.title = dto.title.trim();
    if (dto.description !== undefined)
      album.description = dto.description?.trim() || null;
    if (dto.publishedAt) album.publishedAt = new Date(dto.publishedAt);
    await this.albums.save(album);
    const count = await this.photos.countBy({ albumId: album.id });
    const cover = await this.photos.findOne({
      where: { albumId: album.id, storageState: 'ready' },
      order: { publishedAt: 'ASC', id: 'ASC' },
    });
    return {
      id: album.publicId,
      folder: album.folder,
      title: album.title,
      description: album.description,
      publishedAt: album.publishedAt.toISOString(),
      photoCount: count,
      coverUrl: cover
        ? buildGalleryUrl(config.cdnDomain, cover.displayObjectKey)
        : null,
    };
  }

  async deleteAlbum(publicId: string): Promise<void> {
    await this.requireEnabled();
    const album = await this.album(publicId);
    if (await this.photos.countBy({ albumId: album.id }))
      throw new BusinessException('非空相册不能删除，请先逐张删除照片');
    await this.albums.remove(album);
  }

  async getPhotos(
    albumPublicId: string,
    query: GalleryPhotoQueryDto,
    admin = false,
  ): Promise<IGalleryPhotoPage> {
    const config = await this.requireEnabled();
    const album = await this.album(albumPublicId);
    const qb = this.photos
      .createQueryBuilder('photo')
      .where('photo.albumId = :albumId', { albumId: album.id });
    if (!admin) qb.andWhere('photo.storageState = :ready', { ready: 'ready' });
    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      qb.andWhere(
        new Brackets((nested) =>
          nested
            .where('photo.publishedAt > :date', { date: cursor.date })
            .orWhere('(photo.publishedAt = :date AND photo.id > :id)', {
              date: cursor.date,
              id: cursor.id,
            }),
        ),
      );
    }
    const limit = query.limit || 50;
    const rows = await qb
      .orderBy('photo.publishedAt', 'ASC')
      .addOrderBy('photo.id', 'ASC')
      .take(limit + 1)
      .getMany();
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    return {
      items: rows.map((row) =>
        this.photoSummary(row, album.publicId, config.cdnDomain, admin),
      ),
      nextCursor:
        hasMore && rows.length
          ? this.encodeCursor(rows[rows.length - 1])
          : null,
    };
  }

  async getPhoto(
    publicId: string,
    admin = false,
  ): Promise<IGalleryPhotoDetail> {
    const config = await this.requireEnabled();
    const photo = await this.photos.findOne({
      where: { publicId },
      relations: { album: true },
    });
    if (!photo || (!admin && photo.storageState !== 'ready'))
      throw new BusinessException('照片不存在');
    return {
      ...this.photoSummary(
        photo,
        photo.album.publicId,
        config.cdnDomain,
        admin,
      ),
      sourceMime: photo.sourceMime,
      displayMime: photo.displayMime,
      byteSize: Number(photo.byteSize),
      exif: photo.exif,
    };
  }

  async upload(
    albumPublicId: string,
    file: MultipartFile,
  ): Promise<IGalleryPhotoDetail> {
    const config = await this.requireEnabled();
    const credentials = this.credentials(config);
    if (!credentials) throw new BusinessException('OSS 配置不完整');
    const album = await this.album(albumPublicId);
    const tempDir = await mkdtemp(join(tmpdir(), 'applog-gallery-'));
    const sourcePath = join(tempDir, 'source');
    const convertedPath = join(tempDir, 'display.jpg');
    const written: string[] = [];
    try {
      await pipeline(file.file, createWriteStream(sourcePath, { flags: 'wx' }));
      const fileStat = await stat(sourcePath);
      if (file.file.truncated || fileStat.size > GALLERY_MAX_FILE_SIZE)
        throw new BusinessException('图片超过 30 MB 限制');
      const metadata = await this.images.inspect(
        sourcePath,
        file.mimetype,
        convertedPath,
      );
      const uuid = randomUUID();
      const displayKey = buildGalleryObjectKey(
        config.galleryPath,
        album.folder,
        `${uuid}.${metadata.extension}`,
      );
      const isHeic = metadata.sourceMime === 'image/heic';
      const sourceKey = isHeic
        ? `${config.galleryPath}/.originals/${album.folder}/${uuid}.heic`
        : displayKey;
      if (isHeic) {
        // 先登记再上传，以覆盖“服务端已写入但客户端收到超时”的歧义失败。
        written.push(sourceKey);
        await this.oss.putFile(
          credentials,
          sourceKey,
          sourcePath,
          metadata.sourceMime,
        );
      }
      written.push(displayKey);
      await this.oss.putFile(
        credentials,
        displayKey,
        metadata.displayPath,
        metadata.displayMime,
      );
      const uploadTime = new Date();
      const photo = await this.photos.save(
        this.photos.create({
          publicId: randomUUID(),
          albumId: album.id,
          sourceObjectKey: sourceKey,
          displayObjectKey: displayKey,
          sourceMime: metadata.sourceMime,
          displayMime: metadata.displayMime,
          byteSize: String(fileStat.size),
          width: metadata.width,
          height: metadata.height,
          originalFilename: file.filename.slice(0, 191),
          storageState: 'ready',
          title: null,
          description: null,
          takenAt: metadata.takenAt,
          publishedAt: metadata.takenAt || uploadTime,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
          exif: metadata.exif,
        }),
      );
      return {
        ...this.photoSummary(photo, album.publicId, config.cdnDomain, true),
        sourceMime: photo.sourceMime,
        displayMime: photo.displayMime,
        byteSize: Number(photo.byteSize),
        exif: photo.exif,
      };
    } catch (error) {
      for (const key of [...new Set(written)].reverse()) {
        try {
          await this.oss.delete(credentials, key);
        } catch {
          this.logger.warn(
            `相册上传补偿清理失败: key=${key}`,
            GalleryService.name,
          );
        }
      }
      if (error instanceof BusinessException) throw error;
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'FST_REQ_FILE_TOO_LARGE'
      ) {
        throw new BusinessException('图片超过 30 MB 限制');
      }
      throw new BusinessException(
        error instanceof Error ? error.message : '照片上传失败',
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async updatePhoto(
    publicId: string,
    dto: UpdateGalleryPhotoDto,
  ): Promise<IGalleryPhotoDetail> {
    const config = await this.requireEnabled();
    const photo = await this.photo(publicId);
    if (dto.title !== undefined) photo.title = dto.title?.trim() || null;
    if (dto.description !== undefined)
      photo.description = dto.description?.trim() || null;
    if (dto.publishedAt) photo.publishedAt = new Date(dto.publishedAt);
    const nextLatitude =
      dto.latitude !== undefined ? dto.latitude : photo.latitude;
    const nextLongitude =
      dto.longitude !== undefined ? dto.longitude : photo.longitude;
    if ((nextLatitude === null) !== (nextLongitude === null))
      throw new BusinessException('经纬度必须同时填写或同时清空');
    if (dto.latitude !== undefined) photo.latitude = dto.latitude;
    if (dto.longitude !== undefined) photo.longitude = dto.longitude;
    await this.photos.save(photo);
    const album = await this.albums.findOneBy({ id: photo.albumId });
    return {
      ...this.photoSummary(photo, album.publicId, config.cdnDomain, true),
      sourceMime: photo.sourceMime,
      displayMime: photo.displayMime,
      byteSize: Number(photo.byteSize),
      exif: photo.exif,
    };
  }

  async deletePhoto(publicId: string): Promise<void> {
    const config = await this.requireEnabled();
    const credentials = this.credentials(config);
    if (!credentials) throw new BusinessException('OSS 配置不完整');
    const photo = await this.photos.findOneBy({ publicId });
    // DELETE 对已经清理完成的资源保持幂等，便于客户端安全重试。
    if (!photo) return;
    photo.storageState = 'deleting';
    await this.photos.save(photo);
    try {
      for (const key of [
        ...new Set([photo.sourceObjectKey, photo.displayObjectKey]),
      ])
        await this.oss.delete(credentials, key);
      await this.photos.remove(photo);
    } catch {
      photo.storageState = 'delete_failed';
      await this.photos.save(photo);
      throw new BusinessException(
        '对象删除失败，照片已从公开相册隐藏，可稍后重试',
      );
    }
  }

  private async getOrCreateConfig(): Promise<GalleryConfigEntity> {
    return (
      (await this.configs.findOneBy({ id: 1 })) ||
      this.configs.save(
        this.configs.create({
          id: 1,
          endpoint: '',
          bucket: '',
          accessKeyId: '',
          cdnDomain: '',
          galleryPath: '',
          enabled: false,
          configRevision: 1,
          verifiedRevision: null,
          verifiedAt: null,
        }),
      )
    );
  }
  private maskConfig(config: GalleryConfigEntity): IGalleryAdminConfig {
    const configured = this.isConfigComplete(config);
    return {
      endpoint: config.endpoint,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.secretCiphertext ? GALLERY_SECRET_MASK : '',
      cdnDomain: config.cdnDomain,
      galleryPath: config.galleryPath,
      enabled: config.enabled,
      configRevision: config.configRevision,
      verifiedRevision: config.verifiedRevision,
      verifiedAt: config.verifiedAt?.toISOString() ?? null,
      configured,
      verified: configured && this.isVerified(config),
    };
  }
  private credentials(
    config: GalleryConfigEntity,
  ): GalleryOssCredentials | null {
    if (
      !config.endpoint ||
      !config.bucket ||
      !config.accessKeyId ||
      !config.secretCiphertext ||
      !config.secretNonce ||
      !config.secretAuthTag
    )
      return null;
    try {
      return {
        endpoint: config.endpoint,
        bucket: config.bucket,
        accessKeyId: config.accessKeyId,
        accessKeySecret: this.encryption
          .decrypt(
            {
              ciphertext: config.secretCiphertext,
              nonce: config.secretNonce,
              authTag: config.secretAuthTag,
              envelopeVersion: config.secretEnvelopeVersion as 2,
              keyVersion: config.secretKeyVersion as 1,
            },
            'gallery.oss-credential',
            'gallery-config:1',
          )
          .toString('utf8'),
      };
    } catch {
      return null;
    }
  }
  private isVerified(config: GalleryConfigEntity): boolean {
    return (
      config.verifiedRevision === config.configRevision && !!config.verifiedAt
    );
  }
  private isConfigComplete(config: GalleryConfigEntity): boolean {
    return (
      !!this.credentials(config) && !!config.cdnDomain && !!config.galleryPath
    );
  }
  private async requireEnabled(): Promise<GalleryConfigEntity> {
    const config = await this.configs.findOneBy({ id: 1 });
    if (
      !config?.enabled ||
      !this.isVerified(config) ||
      !this.isConfigComplete(config)
    )
      throw new BusinessException('相册未开启');
    return config;
  }
  private async album(publicId: string): Promise<GalleryAlbumEntity> {
    const value = await this.albums.findOneBy({ publicId });
    if (!value) throw new BusinessException('相册不存在');
    return value;
  }
  private async photo(publicId: string): Promise<GalleryPhotoEntity> {
    const value = await this.photos.findOneBy({ publicId });
    if (!value) throw new BusinessException('照片不存在');
    return value;
  }
  private photoSummary(
    photo: GalleryPhotoEntity,
    albumPublicId: string,
    cdnDomain: string,
    admin: boolean,
  ): IGalleryPhotoSummary {
    return {
      id: photo.publicId,
      albumId: albumPublicId,
      title: photo.title,
      description: photo.description,
      displayUrl: buildGalleryUrl(cdnDomain, photo.displayObjectKey),
      width: photo.width,
      height: photo.height,
      takenAt: photo.takenAt?.toISOString() ?? null,
      publishedAt: photo.publishedAt.toISOString(),
      latitude: photo.latitude,
      longitude: photo.longitude,
      ...(admin ? { storageState: photo.storageState } : {}),
    };
  }
  private encodeCursor(photo: GalleryPhotoEntity): string {
    return Buffer.from(
      JSON.stringify({ date: photo.publishedAt.toISOString(), id: photo.id }),
    ).toString('base64url');
  }
  private decodeCursor(value: string): { date: Date; id: string } {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      );
      const date = new Date(parsed.date);
      if (!parsed.id || Number.isNaN(date.getTime())) throw new Error();
      return { date, id: String(parsed.id) };
    } catch {
      throw new BusinessException('分页游标无效');
    }
  }
}
