import { computed, reactive, ref } from 'vue'
import type {
  ICreateGalleryAlbum,
  IGalleryAlbumSummary,
  IGalleryPhotoSummary,
  IUpdateGalleryAlbum,
  IUpdateGalleryPhoto,
} from '@applog/common'
import { GALLERY_MAX_BATCH_SIZE, GALLERY_MAX_FILE_SIZE } from '@applog/common'
import {
  createGalleryAlbum,
  deleteGalleryAlbum,
  deleteGalleryPhoto,
  getGalleryAlbums,
  getGalleryPhoto,
  getGalleryPhotos,
  getGalleryStatus,
  updateGalleryAlbum,
  updateGalleryPhoto,
  uploadGalleryPhoto,
} from '@/api/gallery'

export type UploadState = 'queued' | 'uploading' | 'success' | 'failure'

export interface UploadItem {
  id: string
  albumId: string
  file: File
  state: UploadState
  error?: string
}

export interface GalleryAlbumPhotosState {
  items: IGalleryPhotoSummary[]
  nextCursor: string | null
  loading: boolean
  error: string
  retryAppend: boolean
}

/**
 * 管理公开相册摘要、当前相册照片和管理员上传队列。
 * @param isAdmin 获取当前用户是否为管理员
 * @returns 相册页面共享的响应式状态与操作
 */
export function useGallery(isAdmin: () => boolean) {
  const enabled = ref(false)
  const loading = ref(true)
  const error = ref('')
  const albums = ref<IGalleryAlbumSummary[]>([])
  const albumPhotos = reactive<Record<string, GalleryAlbumPhotosState>>({})
  const uploads = ref<UploadItem[]>([])
  let loadRevision = 0
  let albumLoadRevision = 0
  let photoLoadRevision = 0
  const photoLoadRevisions = new Map<string, number>()
  const uploadBusy = computed(() =>
    uploads.value.some((item) => item.state === 'queued' || item.state === 'uploading'),
  )
  const errorText = (value: unknown) =>
    value instanceof Error ? value.message : '请求失败，请稍后重试'

  function stateFor(albumId: string): GalleryAlbumPhotosState {
    if (!albumPhotos[albumId]) {
      albumPhotos[albumId] = {
        items: [],
        nextCursor: null,
        loading: false,
        error: '',
        retryAppend: false,
      }
    }
    return albumPhotos[albumId]
  }

  function clearAlbums(): void {
    albums.value = []
    Object.keys(albumPhotos).forEach((albumId) => {
      delete albumPhotos[albumId]
      photoLoadRevisions.delete(albumId)
    })
  }

  async function loadAlbums(isCurrent: () => boolean = () => true): Promise<void> {
    const revision = ++albumLoadRevision
    const nextAlbums = await getGalleryAlbums(isAdmin())
    if (revision !== albumLoadRevision || !isCurrent()) return
    const nextIds = new Set(nextAlbums.map((album) => album.id))
    Object.keys(albumPhotos).forEach((albumId) => {
      if (!nextIds.has(albumId)) {
        delete albumPhotos[albumId]
        photoLoadRevisions.delete(albumId)
      }
    })
    albums.value = nextAlbums
  }

  async function load(): Promise<void> {
    const revision = ++loadRevision
    loading.value = true
    error.value = ''
    try {
      const status = await getGalleryStatus()
      if (revision !== loadRevision) return
      enabled.value = status.enabled
      if (!status.enabled) {
        clearAlbums()
        return
      }

      await loadAlbums(() => revision === loadRevision)
      if (revision !== loadRevision) return
    } catch (cause) {
      if (revision !== loadRevision) return
      enabled.value = false
      clearAlbums()
      error.value = errorText(cause)
    } finally {
      if (revision === loadRevision) loading.value = false
    }
  }

  async function loadPhotos(albumId: string, append = false): Promise<void> {
    const state = stateFor(albumId)
    if (append && !state.nextCursor) return
    const revision = ++photoLoadRevision
    photoLoadRevisions.set(albumId, revision)
    state.loading = true
    state.error = ''
    try {
      const page = await getGalleryPhotos(
        albumId,
        append ? (state.nextCursor ?? undefined) : undefined,
        isAdmin(),
      )
      if (photoLoadRevisions.get(albumId) !== revision) return
      state.items = append ? [...state.items, ...page.items] : page.items
      state.nextCursor = page.nextCursor
    } catch (cause) {
      if (photoLoadRevisions.get(albumId) !== revision) return
      state.error = errorText(cause)
      state.retryAppend = append
    } finally {
      if (photoLoadRevisions.get(albumId) === revision) state.loading = false
    }
  }

  async function createAlbum(value: ICreateGalleryAlbum): Promise<void> {
    await createGalleryAlbum(value)
    await load()
  }

  async function updateAlbum(albumId: string, value: IUpdateGalleryAlbum): Promise<void> {
    await updateGalleryAlbum(albumId, value)
    await load()
  }

  async function removeAlbum(albumId: string): Promise<void> {
    await deleteGalleryAlbum(albumId)
    await load()
  }

  async function updatePhoto(
    albumId: string,
    photoId: string,
    value: IUpdateGalleryPhoto,
  ): Promise<void> {
    await updateGalleryPhoto(photoId, value)
    await Promise.allSettled([loadAlbums(), loadPhotos(albumId)])
  }

  async function removePhoto(albumId: string, photoId: string): Promise<void> {
    try {
      await deleteGalleryPhoto(photoId)
    } catch (cause) {
      await Promise.allSettled([loadAlbums(), loadPhotos(albumId)])
      throw cause
    }
    await Promise.allSettled([loadAlbums(), loadPhotos(albumId)])
  }

  async function uploadFiles(albumId: string, fileList: FileList | File[]): Promise<void> {
    const files = Array.from(fileList)
    if (uploadBusy.value) throw new Error('已有照片正在上传，请等待当前批次完成')
    if (files.length > GALLERY_MAX_BATCH_SIZE)
      throw new Error(`单次最多上传 ${GALLERY_MAX_BATCH_SIZE} 张图片`)
    const invalid = files.find((file) => file.size > GALLERY_MAX_FILE_SIZE)
    if (invalid) throw new Error(`${invalid.name} 超过 30 MB`)

    const items: UploadItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      albumId,
      file,
      state: 'queued',
    }))
    uploads.value = items
    let cursor = 0
    async function worker(): Promise<void> {
      while (cursor < items.length) {
        const item = items[cursor++]
        if (!item) return
        item.state = 'uploading'
        try {
          await uploadGalleryPhoto(albumId, item.file)
          item.state = 'success'
        } catch (cause) {
          item.state = 'failure'
          item.error = errorText(cause)
        }
      }
    }
    await Promise.all([worker(), worker()])
    await Promise.allSettled([loadAlbums(), loadPhotos(albumId)])
  }

  async function retryUpload(item: UploadItem): Promise<void> {
    item.state = 'uploading'
    item.error = undefined
    try {
      await uploadGalleryPhoto(item.albumId, item.file)
      item.state = 'success'
      await Promise.allSettled([loadAlbums(), loadPhotos(item.albumId)])
    } catch (cause) {
      item.state = 'failure'
      item.error = errorText(cause)
    }
  }

  function uploadsFor(albumId: string): UploadItem[] {
    return uploads.value.filter((item) => item.albumId === albumId)
  }

  async function loadPhoto(photoId: string) {
    return getGalleryPhoto(photoId, isAdmin())
  }

  return {
    enabled,
    loading,
    error,
    albums,
    albumPhotos,
    uploads,
    uploadBusy,
    load,
    loadPhoto,
    loadPhotos,
    createAlbum,
    updateAlbum,
    removeAlbum,
    updatePhoto,
    removePhoto,
    uploadFiles,
    retryUpload,
    uploadsFor,
  }
}
