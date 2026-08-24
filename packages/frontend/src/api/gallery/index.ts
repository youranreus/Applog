import type { ICreateGalleryAlbum, IGalleryAdminConfig, IGalleryAlbumSummary, IGalleryPhotoDetail, IGalleryPhotoPage, IGalleryStatus, IUpdateGalleryAlbum, IUpdateGalleryPhoto } from '@applog/common';
import { alovaInstance } from '@/utils/alova';

export const getGalleryStatus = () => alovaInstance.Get<IGalleryStatus>('/gallery/status');
export const getGalleryAlbums = (admin = false) => alovaInstance.Get<IGalleryAlbumSummary[]>(admin ? '/gallery/admin/albums' : '/gallery/albums');
export const getGalleryPhotos = (albumId: string, cursor?: string, admin = false) =>
  alovaInstance.Get<IGalleryPhotoPage>(admin ? `/gallery/admin/albums/${albumId}/photos` : `/gallery/albums/${albumId}/photos`, { params: cursor ? { cursor } : undefined });
export const getGalleryPhoto = (id: string, admin = false) => alovaInstance.Get<IGalleryPhotoDetail>(admin ? `/gallery/admin/photos/${id}` : `/gallery/photos/${id}`);
export const getGalleryConfig = () => alovaInstance.Get<IGalleryAdminConfig>('/gallery/admin/config');
export const setGalleryConfig = (value: Omit<IGalleryAdminConfig, 'configRevision' | 'verifiedRevision' | 'verifiedAt' | 'configured' | 'verified'>) =>
  alovaInstance.Put<IGalleryAdminConfig>('/gallery/admin/config', value);
export const testGalleryConfig = () => alovaInstance.Post<IGalleryAdminConfig>('/gallery/admin/config/test', {});
export const createGalleryAlbum = (value: ICreateGalleryAlbum) => alovaInstance.Post<IGalleryAlbumSummary>('/gallery/admin/albums', value);
export const updateGalleryAlbum = (id: string, value: IUpdateGalleryAlbum) => alovaInstance.Patch<IGalleryAlbumSummary>(`/gallery/admin/albums/${id}`, value);
export const deleteGalleryAlbum = (id: string) => alovaInstance.Delete<void>(`/gallery/admin/albums/${id}`);
export const uploadGalleryPhoto = (albumId: string, file: File) => { const form = new FormData(); form.append('file', file); return alovaInstance.Post<IGalleryPhotoDetail>(`/gallery/admin/albums/${albumId}/photos`, form); };
export const updateGalleryPhoto = (id: string, value: IUpdateGalleryPhoto) => alovaInstance.Patch<IGalleryPhotoDetail>(`/gallery/admin/photos/${id}`, value);
export const deleteGalleryPhoto = (id: string) => alovaInstance.Delete<void>(`/gallery/admin/photos/${id}`);
