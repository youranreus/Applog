import { computed, ref } from 'vue';
import type { ICreateGalleryAlbum, IGalleryAlbumSummary, IGalleryPhotoSummary, IUpdateGalleryAlbum, IUpdateGalleryPhoto } from '@applog/common';
import { GALLERY_MAX_BATCH_SIZE, GALLERY_MAX_FILE_SIZE } from '@applog/common';
import { createGalleryAlbum, deleteGalleryAlbum, deleteGalleryPhoto, getGalleryAlbums, getGalleryPhotos, getGalleryStatus, updateGalleryAlbum, updateGalleryPhoto, uploadGalleryPhoto } from '@/api/gallery';

export type UploadState = 'queued' | 'uploading' | 'success' | 'failure';
export interface UploadItem { id: string; albumId: string; file: File; state: UploadState; error?: string; }

export function useGallery(isAdmin: () => boolean) {
  const enabled = ref(false); const loading = ref(true); const error = ref('');
  const albums = ref<IGalleryAlbumSummary[]>([]); const selectedId = ref<string | null>(null);
  const photos = ref<IGalleryPhotoSummary[]>([]); const nextCursor = ref<string | null>(null);
  const photosLoading = ref(false); const uploads = ref<UploadItem[]>([]);
  const uploadBusy = computed(() => uploads.value.some((item) => item.state === 'queued' || item.state === 'uploading'));
  const selectedAlbum = computed(() => albums.value.find((album) => album.id === selectedId.value) ?? null);
  const errorText = (value: unknown) => value instanceof Error ? value.message : '请求失败，请稍后重试';

  async function load(): Promise<void> {
    loading.value = true; error.value = '';
    try { const status = await getGalleryStatus(); enabled.value = status.enabled;
      if (!status.enabled) {
        albums.value = []; selectedId.value = null;
        photos.value = []; nextCursor.value = null; return;
      }
      albums.value = await getGalleryAlbums(isAdmin());
      const keep = albums.value.some((album) => album.id === selectedId.value);
      selectedId.value = keep ? selectedId.value : albums.value[0]?.id ?? null;
      await loadPhotos(false);
    } catch (e) {
      enabled.value = false; albums.value = []; selectedId.value = null;
      photos.value = []; nextCursor.value = null; error.value = errorText(e);
    } finally { loading.value = false; }
  }
  async function loadPhotos(append = false): Promise<void> {
    if (!selectedId.value) { photos.value = []; nextCursor.value = null; return; }
    photosLoading.value = true;
    try { const page = await getGalleryPhotos(selectedId.value, append ? nextCursor.value ?? undefined : undefined, isAdmin());
      photos.value = append ? [...photos.value, ...page.items] : page.items; nextCursor.value = page.nextCursor;
    } catch (e) { error.value = errorText(e); } finally { photosLoading.value = false; }
  }
  async function selectAlbum(id: string): Promise<void> { selectedId.value = id; await loadPhotos(false); }
  async function createAlbum(value: ICreateGalleryAlbum): Promise<void> { await createGalleryAlbum(value); await load(); }
  async function updateAlbum(value: IUpdateGalleryAlbum): Promise<void> { if (!selectedId.value) return; await updateGalleryAlbum(selectedId.value, value); await load(); }
  async function removeAlbum(): Promise<void> { if (!selectedId.value) return; await deleteGalleryAlbum(selectedId.value); selectedId.value = null; await load(); }
  async function updatePhoto(id: string, value: IUpdateGalleryPhoto): Promise<void> { await updateGalleryPhoto(id, value); await loadPhotos(false); }
  async function removePhoto(id: string): Promise<void> { await deleteGalleryPhoto(id); await load(); }
  async function uploadFiles(fileList: FileList | File[]): Promise<void> {
    if (!selectedId.value) return; const files = Array.from(fileList);
    if (uploadBusy.value) throw new Error('已有照片正在上传，请等待当前批次完成');
    if (files.length > GALLERY_MAX_BATCH_SIZE) throw new Error(`单次最多上传 ${GALLERY_MAX_BATCH_SIZE} 张图片`);
    const invalid = files.find((file) => file.size > GALLERY_MAX_FILE_SIZE);
    if (invalid) throw new Error(`${invalid.name} 超过 30 MB`);
    const albumId = selectedId.value;
    const items: UploadItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      albumId,
      file,
      state: 'queued',
    }));
    uploads.value = items;
    let cursor = 0;
    async function worker(): Promise<void> { while (cursor < items.length) { const item = items[cursor++]; if (!item) return; item.state = 'uploading';
      try { await uploadGalleryPhoto(albumId, item.file); item.state = 'success'; }
      catch (e) { item.state = 'failure'; item.error = errorText(e); } } }
    await Promise.all([worker(), worker()]); await load();
  }
  async function retryUpload(item: UploadItem): Promise<void> { item.state = 'uploading'; item.error = undefined;
    try { await uploadGalleryPhoto(item.albumId, item.file); item.state = 'success'; await load(); }
    catch (e) { item.state = 'failure'; item.error = errorText(e); } }
  return { enabled, loading, error, albums, selectedId, selectedAlbum, photos, nextCursor, photosLoading, uploads, uploadBusy,
    load, loadPhotos, selectAlbum, createAlbum, updateAlbum, removeAlbum, updatePhoto, removePhoto, uploadFiles, retryUpload };
}
