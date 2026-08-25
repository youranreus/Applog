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

export function useGallery(isAdmin: () => boolean) {
  const enabled = ref(false)
  const loading = ref(true)
  const error = ref('')
  const albums = ref<IGalleryAlbumSummary[]>([])
  const albumPhotos = reactive<Record<string, GalleryAlbumPhotosState>>({})
  const uploads = ref<UploadItem[]>([])
  const uploadBusy = computed(() =>
    uploads.value.some((item) => item.state === 'queued' || item.state === 'uploading'),
  )
  const errorText = (value: unknown) =>
    value instanceof Error ? value.message : '请求失败，请稍后重试'

  function stateFor(albumId: string): GalleryAlbumPhotosState {
    return (albumPhotos[albumId] ??= {
      items: [],
      nextCursor: null,
      loading: false,
      error: '',
      retryAppend: false,
    })
  }

  function clearAlbums(): void {
    albums.value = []
    Object.keys(albumPhotos).forEach((albumId) => delete albumPhotos[albumId])
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const status = await getGalleryStatus()
      enabled.value = status.enabled
      if (!status.enabled) {
        clearAlbums()
        return
      }

      const nextAlbums = await getGalleryAlbums(isAdmin())
      const nextIds = new Set(nextAlbums.map((album) => album.id))
      Object.keys(albumPhotos).forEach((albumId) => {
        if (!nextIds.has(albumId)) delete albumPhotos[albumId]
      })
      albums.value = nextAlbums
      nextAlbums.forEach((album) => stateFor(album.id))
      await Promise.all(nextAlbums.map((album) => loadPhotos(album.id)))
    } catch (cause) {
      enabled.value = false
      clearAlbums()
      error.value = errorText(cause)
    } finally {
      loading.value = false
    }
  }

  async function loadPhotos(albumId: string, append = false): Promise<void> {
    const state = stateFor(albumId)
    if (append && !state.nextCursor) return
    state.loading = true
    state.error = ''
    try {
      const page = await getGalleryPhotos(
        albumId,
        append ? (state.nextCursor ?? undefined) : undefined,
        isAdmin(),
      )
      state.items = append ? [...state.items, ...page.items] : page.items
      state.nextCursor = page.nextCursor
    } catch (cause) {
      state.error = errorText(cause)
      state.retryAppend = append
    } finally {
      state.loading = false
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
    await loadPhotos(albumId)
  }

  async function removePhoto(photoId: string): Promise<void> {
    await deleteGalleryPhoto(photoId)
    await load()
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
    await load()
  }

  async function retryUpload(item: UploadItem): Promise<void> {
    item.state = 'uploading'
    item.error = undefined
    try {
      await uploadGalleryPhoto(item.albumId, item.file)
      item.state = 'success'
      await load()
    } catch (cause) {
      item.state = 'failure'
      item.error = errorText(cause)
    }
  }

  function uploadsFor(albumId: string): UploadItem[] {
    return uploads.value.filter((item) => item.albumId === albumId)
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
