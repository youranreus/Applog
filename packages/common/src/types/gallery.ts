import type { GalleryPhotoStorageState } from "../constants/gallery.js";
export interface IGalleryStatus { enabled: boolean; }
export interface IGalleryAdminConfig {
  endpoint: string; bucket: string; accessKeyId: string; accessKeySecret: string;
  cdnDomain: string; galleryPath: string; enabled: boolean;
  configRevision: number; verifiedRevision: number | null; verifiedAt: string | null;
  configured: boolean; verified: boolean;
}
export interface IGalleryExif {
  make?: string; model?: string; lensModel?: string; focalLength?: number;
  aperture?: number; exposureTime?: number; iso?: number; exposureBias?: number;
  orientation?: number;
}
export interface IGalleryAlbumSummary {
  id: string; folder: string; title: string; description: string | null;
  publishedAt: string; photoCount: number; coverUrl: string | null;
}
export interface IGalleryPhotoSummary {
  id: string; albumId: string; title: string | null; description: string | null;
  displayUrl: string; width: number; height: number; takenAt: string | null;
  publishedAt: string; latitude: number | null; longitude: number | null;
  storageState?: GalleryPhotoStorageState;
}
export interface IGalleryPhotoDetail extends IGalleryPhotoSummary {
  sourceMime: string; displayMime: string; byteSize: number; exif: IGalleryExif | null;
}
export interface IGalleryPhotoPage { items: IGalleryPhotoSummary[]; nextCursor: string | null; }
export interface ICreateGalleryAlbum { folder: string; title: string; description?: string; publishedAt?: string; }
export interface IUpdateGalleryAlbum { title?: string; description?: string | null; publishedAt?: string; }
export interface IUpdateGalleryPhoto {
  title?: string | null; description?: string | null; publishedAt?: string;
  latitude?: number | null; longitude?: number | null;
}
