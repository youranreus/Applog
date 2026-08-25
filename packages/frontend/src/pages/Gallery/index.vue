<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import {
  CameraIcon,
  ImagePlusIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from '@lucide/vue'
import type {
  IGalleryAlbumSummary,
  IGalleryPhotoDetail,
  IGalleryPhotoSummary,
} from '@applog/common'
import { getGalleryPhoto } from '@/api/gallery'
import { USER_ROLES } from '@/constants/permission'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { useUserStore } from '@/stores/useUserStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSeoHead } from '@/hooks/useSeoHead'
import { useGallery } from './useGallery'

const users = useUserStore()
const layout = useLayoutStore()
const isAdmin = computed(() => users.user?.role === USER_ROLES.ADMIN)
const gallery = useGallery(() => isAdmin.value)
const isMultiColumn = useMediaQuery('(min-width: 701px)')
const isThreeColumn = useMediaQuery('(min-width: 1101px)')
const albumDialog = ref(false)
const editingAlbumId = ref<string | null>(null)
const albumForm = reactive({ folder: '', title: '', description: '', publishedAt: '' })
const previewOpen = ref(false)
const preview = ref<IGalleryPhotoDetail | null>(null)
const previewLoading = ref(false)
const editingPhoto = ref(false)
const photoForm = reactive({
  title: '',
  description: '',
  publishedAt: '',
  latitude: '',
  longitude: '',
})
const fileInput = ref<HTMLInputElement | null>(null)
const uploadAlbumId = ref<string | null>(null)
const GalleryMap = defineAsyncComponent(() => import('./GalleryMap.vue'))

useSeoHead({
  title: '相册',
  description: '按时间浏览照片与相册',
  canonicalPath: '/gallery',
  type: 'website',
})

function toLocal(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function iso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function photoColumns(albumId: string): IGalleryPhotoSummary[][] {
  const items = gallery.albumPhotos[albumId]?.items ?? []
  const count = isThreeColumn.value ? 3 : isMultiColumn.value ? 2 : 1
  const columns: IGalleryPhotoSummary[][] = Array.from({ length: count }, () => [])
  const columnHeights = Array.from({ length: count }, () => 0)
  items.forEach((photo) => {
    const shortestHeight = Math.min(...columnHeights)
    const columnIndex = columnHeights.indexOf(shortestHeight)
    columns[columnIndex]?.push(photo)
    columnHeights[columnIndex] = (columnHeights[columnIndex] ?? 0) + photo.height / photo.width
  })
  return columns
}

function openCreate(): void {
  editingAlbumId.value = null
  Object.assign(albumForm, {
    folder: '',
    title: '',
    description: '',
    publishedAt: toLocal(new Date().toISOString()),
  })
  albumDialog.value = true
}

function openEditAlbum(album: IGalleryAlbumSummary): void {
  editingAlbumId.value = album.id
  Object.assign(albumForm, {
    folder: album.folder,
    title: album.title,
    description: album.description ?? '',
    publishedAt: toLocal(album.publishedAt),
  })
  albumDialog.value = true
}

async function saveAlbum(): Promise<void> {
  try {
    const publishedAt = iso(albumForm.publishedAt)
    if (editingAlbumId.value) {
      await gallery.updateAlbum(editingAlbumId.value, {
        title: albumForm.title,
        description: albumForm.description || null,
        ...(publishedAt ? { publishedAt } : {}),
      })
    } else {
      await gallery.createAlbum({
        folder: albumForm.folder,
        title: albumForm.title,
        description: albumForm.description,
        ...(publishedAt ? { publishedAt } : {}),
      })
    }
    albumDialog.value = false
  } catch (cause) {
    layout.notify({
      title: '保存相册失败',
      content: cause instanceof Error ? cause.message : '请稍后重试',
      type: 'error',
    })
  }
}

async function removeAlbum(album: IGalleryAlbumSummary): Promise<void> {
  if (!window.confirm(`确定删除空相册“${album.title}”吗？`)) return
  try {
    await gallery.removeAlbum(album.id)
  } catch (cause) {
    layout.notify({
      title: '删除失败',
      content: cause instanceof Error ? cause.message : '请稍后重试',
      type: 'error',
    })
  }
}

function beginUpload(albumId: string): void {
  uploadAlbumId.value = albumId
  fileInput.value?.click()
}

async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  if (!input.files?.length || !uploadAlbumId.value) return
  try {
    await gallery.uploadFiles(uploadAlbumId.value, input.files)
  } catch (cause) {
    layout.notify({
      title: '无法开始上传',
      content: cause instanceof Error ? cause.message : '请检查文件',
      type: 'error',
    })
  } finally {
    input.value = ''
  }
}

async function openPhoto(photo: IGalleryPhotoSummary): Promise<void> {
  previewOpen.value = true
  previewLoading.value = true
  preview.value = null
  editingPhoto.value = false
  try {
    preview.value = await getGalleryPhoto(photo.id, isAdmin.value)
  } catch (cause) {
    layout.notify({
      title: '照片详情加载失败',
      content: cause instanceof Error ? cause.message : '请稍后重试',
      type: 'error',
    })
    previewOpen.value = false
  } finally {
    previewLoading.value = false
  }
}

function startPhotoEdit(): void {
  if (!preview.value) return
  Object.assign(photoForm, {
    title: preview.value.title ?? '',
    description: preview.value.description ?? '',
    publishedAt: toLocal(preview.value.publishedAt),
    latitude: preview.value.latitude?.toString() ?? '',
    longitude: preview.value.longitude?.toString() ?? '',
  })
  editingPhoto.value = true
}

async function savePhoto(): Promise<void> {
  if (!preview.value) return
  try {
    const latitude = photoForm.latitude.trim() === '' ? null : Number(photoForm.latitude)
    const longitude = photoForm.longitude.trim() === '' ? null : Number(photoForm.longitude)
    await gallery.updatePhoto(preview.value.albumId, preview.value.id, {
      title: photoForm.title || null,
      description: photoForm.description || null,
      publishedAt: iso(photoForm.publishedAt),
      latitude,
      longitude,
    })
    preview.value = await getGalleryPhoto(preview.value.id, true)
    editingPhoto.value = false
  } catch (cause) {
    layout.notify({
      title: '照片信息保存失败',
      content: cause instanceof Error ? cause.message : '请稍后重试',
      type: 'error',
    })
  }
}

async function removePhoto(): Promise<void> {
  if (!preview.value || !window.confirm('确定删除这张照片及其 OSS 对象吗？')) return
  const { albumId, id } = preview.value
  try {
    await gallery.removePhoto(id)
    previewOpen.value = false
  } catch (cause) {
    layout.notify({
      title: '删除失败',
      content: cause instanceof Error ? cause.message : '可稍后重试',
      type: 'error',
    })
    await gallery.loadPhotos(albumId)
  }
}

const hasGps = computed(() => preview.value?.latitude != null && preview.value?.longitude != null)

watch(previewOpen, (open) => {
  if (!open) {
    preview.value = null
    editingPhoto.value = false
  }
})

onMounted(gallery.load)
</script>

<template>
  <div class="gallery-root">
    <main class="gallery-page">
      <section v-if="gallery.loading.value" class="gallery-state">
        <CameraIcon class="size-7" />
        <p>正在打开相册…</p>
      </section>
      <section v-else-if="gallery.error.value" class="gallery-state">
        <p>{{ gallery.error.value }}</p>
        <Button variant="outline" @click="gallery.load"><RefreshCwIcon />重试</Button>
      </section>
      <section v-else-if="!gallery.enabled.value" class="gallery-state">
        <CameraIcon class="size-8" />
        <h1>相册暂未开放</h1>
        <p>管理员启用并验证存储配置后，这里会出现照片。</p>
      </section>
      <template v-else>
        <div v-if="isAdmin" class="gallery-toolbar">
          <Button variant="outline" @click="openCreate"> <PlusIcon />新建相册 </Button>
        </div>

        <section v-if="!gallery.albums.value.length" class="gallery-state compact">
          <ImagePlusIcon class="size-7" />
          <h2>还没有相册</h2>
          <p v-if="isAdmin">创建第一本相册，再把照片放进来。</p>
        </section>

        <div v-else class="album-list">
          <section v-for="album in gallery.albums.value" :key="album.id" class="album-section">
            <header class="album-heading">
              <div>
                <h2>{{ album.title }}</h2>
                <p v-if="album.description">{{ album.description }}</p>
                <time :datetime="album.publishedAt">
                  {{ formatDate(album.publishedAt) }} · {{ album.photoCount }} 张
                </time>
              </div>
              <div v-if="isAdmin" class="admin-actions">
                <Button
                  variant="outline"
                  :disabled="gallery.uploadBusy.value"
                  @click="beginUpload(album.id)"
                >
                  <UploadIcon />上传照片
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  :aria-label="`编辑相册 ${album.title}`"
                  @click="openEditAlbum(album)"
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  :aria-label="`删除空相册 ${album.title}`"
                  :disabled="album.photoCount > 0"
                  @click="removeAlbum(album)"
                >
                  <Trash2Icon />
                </Button>
              </div>
            </header>

            <div v-if="gallery.uploadsFor(album.id).length" class="upload-list" aria-live="polite">
              <div v-for="item in gallery.uploadsFor(album.id)" :key="item.id">
                <span>{{ item.file.name }}</span>
                <span :class="`upload-${item.state}`">
                  {{
                    {
                      queued: '等待',
                      uploading: '上传中',
                      success: '完成',
                      failure: item.error || '失败',
                    }[item.state]
                  }}
                </span>
                <Button
                  v-if="item.state === 'failure'"
                  variant="link"
                  size="xs"
                  @click="gallery.retryUpload(item)"
                >
                  重试
                </Button>
              </div>
            </div>

            <div
              v-if="
                gallery.albumPhotos[album.id]?.loading &&
                !gallery.albumPhotos[album.id]?.items.length
              "
              class="gallery-state compact"
            >
              正在读取照片…
            </div>
            <div
              v-else-if="
                gallery.albumPhotos[album.id]?.error && !gallery.albumPhotos[album.id]?.items.length
              "
              class="gallery-state compact"
            >
              <p>{{ gallery.albumPhotos[album.id]?.error }}</p>
              <Button variant="outline" size="sm" @click="gallery.loadPhotos(album.id)">
                重试
              </Button>
            </div>
            <div
              v-else-if="!gallery.albumPhotos[album.id]?.items.length"
              class="gallery-state compact"
            >
              <p>这本相册还是空的。</p>
              <Button
                v-if="isAdmin"
                variant="outline"
                :disabled="gallery.uploadBusy.value"
                @click="beginUpload(album.id)"
              >
                <UploadIcon />上传第一张
              </Button>
            </div>
            <div v-else class="photo-grid">
              <div
                v-for="(column, columnIndex) in photoColumns(album.id)"
                :key="columnIndex"
                class="photo-grid__column"
              >
                <button
                  v-for="photo in column"
                  :key="photo.id"
                  type="button"
                  class="photo-tile"
                  :style="{ aspectRatio: `${photo.width} / ${photo.height}` }"
                  @click="openPhoto(photo)"
                >
                  <img
                    :src="photo.displayUrl"
                    :alt="photo.title || '相册照片'"
                    :width="photo.width"
                    :height="photo.height"
                    loading="lazy"
                  />
                  <span v-if="photo.storageState === 'delete_failed'" class="photo-badge">
                    删除失败 · 点开重试
                  </span>
                  <span class="photo-caption">
                    {{ photo.title || formatDate(photo.publishedAt) }}
                  </span>
                </button>
              </div>
            </div>
            <div
              v-if="
                gallery.albumPhotos[album.id]?.error && gallery.albumPhotos[album.id]?.items.length
              "
              class="load-more-error"
              role="alert"
            >
              <span>{{ gallery.albumPhotos[album.id]?.error }}</span>
              <Button
                variant="link"
                size="xs"
                @click="
                  gallery.loadPhotos(album.id, gallery.albumPhotos[album.id]?.retryAppend ?? false)
                "
              >
                重试
              </Button>
            </div>
            <div v-else-if="gallery.albumPhotos[album.id]?.nextCursor" class="load-more">
              <Button
                variant="outline"
                :disabled="gallery.albumPhotos[album.id]?.loading"
                @click="gallery.loadPhotos(album.id, true)"
              >
                {{ gallery.albumPhotos[album.id]?.loading ? '加载中…' : '加载更多' }}
              </Button>
            </div>
          </section>
        </div>

        <input
          v-if="isAdmin"
          ref="fileInput"
          class="sr-only"
          type="file"
          multiple
          :disabled="gallery.uploadBusy.value"
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
          @change="upload"
        />
      </template>
    </main>

    <Dialog v-if="isAdmin" v-model:open="albumDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingAlbumId ? '编辑相册' : '新建相册' }}</DialogTitle>
          <DialogDescription>相册目录创建后不可修改，展示标题可以随时更新。</DialogDescription>
        </DialogHeader>
        <Field><FieldLabel>标题</FieldLabel><Input v-model="albumForm.title" /></Field>
        <Field>
          <FieldLabel>目录</FieldLabel>
          <Input
            v-model="albumForm.folder"
            :disabled="Boolean(editingAlbumId)"
            placeholder="travel-2026"
          />
        </Field>
        <Field> <FieldLabel>描述</FieldLabel><Textarea v-model="albumForm.description" /> </Field>
        <Field>
          <FieldLabel>发布时间</FieldLabel>
          <Input v-model="albumForm.publishedAt" type="datetime-local" />
        </Field>
        <DialogFooter>
          <Button variant="outline" @click="albumDialog = false">取消</Button>
          <Button @click="saveAlbum">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="previewOpen">
      <DialogContent class="gallery-preview" overlay-class="bg-black/90" :show-close-button="false">
        <DialogTitle class="sr-only">{{ preview?.title || '照片详情' }}</DialogTitle>
        <DialogDescription class="sr-only">查看照片及其拍摄信息</DialogDescription>
        <DialogClose as-child>
          <Button variant="ghost" size="icon" class="preview-close" aria-label="关闭照片预览">
            <XIcon />
          </Button>
        </DialogClose>
        <div v-if="previewLoading" class="grid h-full place-items-center text-white/70">
          正在加载照片…
        </div>
        <template v-else-if="preview">
          <div class="preview-image">
            <img :src="preview.displayUrl" :alt="preview.title || '相册照片'" />
          </div>
          <aside class="metadata-rail">
            <div class="metadata-title">
              <div>
                <h2>{{ preview.title || '未命名照片' }}</h2>
                <p>{{ preview.description || '没有文字说明' }}</p>
              </div>
              <Button
                v-if="isAdmin"
                variant="ghost"
                size="icon"
                aria-label="编辑照片"
                @click="startPhotoEdit"
              >
                <PencilIcon />
              </Button>
            </div>
            <template v-if="editingPhoto">
              <Field><FieldLabel>标题</FieldLabel><Input v-model="photoForm.title" /></Field>
              <Field>
                <FieldLabel>描述</FieldLabel><Textarea v-model="photoForm.description" />
              </Field>
              <Field>
                <FieldLabel>发布时间</FieldLabel>
                <Input v-model="photoForm.publishedAt" type="datetime-local" />
              </Field>
              <div class="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel>纬度</FieldLabel>
                  <Input v-model="photoForm.latitude" type="number" step="any" />
                </Field>
                <Field>
                  <FieldLabel>经度</FieldLabel>
                  <Input v-model="photoForm.longitude" type="number" step="any" />
                </Field>
              </div>
              <div class="flex gap-2">
                <Button @click="savePhoto">保存</Button>
                <Button variant="outline" @click="editingPhoto = false">取消</Button>
              </div>
            </template>
            <template v-else>
              <dl class="metadata-list">
                <div>
                  <dt>发布时间</dt>
                  <dd>{{ new Date(preview.publishedAt).toLocaleString('zh-CN') }}</dd>
                </div>
                <div v-if="preview.takenAt">
                  <dt>拍摄时间</dt>
                  <dd>{{ new Date(preview.takenAt).toLocaleString('zh-CN') }}</dd>
                </div>
                <div>
                  <dt>尺寸</dt>
                  <dd>{{ preview.width }} × {{ preview.height }}</dd>
                </div>
                <div v-if="preview.exif?.make || preview.exif?.model">
                  <dt>相机</dt>
                  <dd>{{ [preview.exif?.make, preview.exif?.model].filter(Boolean).join(' ') }}</dd>
                </div>
                <div v-if="preview.exif?.lensModel">
                  <dt>镜头</dt>
                  <dd>{{ preview.exif.lensModel }}</dd>
                </div>
                <div v-if="preview.exif?.aperture">
                  <dt>光圈</dt>
                  <dd>ƒ/{{ preview.exif.aperture }}</dd>
                </div>
                <div v-if="preview.exif?.exposureTime">
                  <dt>快门</dt>
                  <dd>{{ preview.exif.exposureTime }}s</dd>
                </div>
                <div v-if="preview.exif?.iso">
                  <dt>ISO</dt>
                  <dd>{{ preview.exif.iso }}</dd>
                </div>
              </dl>
              <div v-if="hasGps" class="space-y-2">
                <GalleryMap :latitude="preview.latitude!" :longitude="preview.longitude!" />
                <p class="text-xs text-muted-foreground">
                  {{ preview.latitude?.toFixed(6) }}, {{ preview.longitude?.toFixed(6) }}
                </p>
              </div>
              <div v-if="isAdmin" class="mt-auto">
                <Button variant="destructive" @click="removePhoto">
                  <Trash2Icon />
                  {{ preview.storageState === 'delete_failed' ? '重试删除' : '删除照片' }}
                </Button>
              </div>
            </template>
          </aside>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.gallery-page {
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding-top: clamp(2.5rem, 6vh, 4.5rem);
  padding-right: clamp(1.5rem, 4vw, 3rem);
  padding-bottom: 5rem;
  padding-left: clamp(1.5rem, 4vw, 3rem);
}

.gallery-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
}

.album-list {
  display: flex;
  flex-direction: column;
  gap: 5rem;
}

.album-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

.album-heading h2 {
  font-family: var(--font-heading);
  font-size: clamp(1.45rem, 1.25rem + 0.7vw, 1.85rem);
  font-weight: 600;
  letter-spacing: -0.025em;
}

.album-heading p {
  max-width: 42rem;
  margin-top: 0.4rem;
  color: var(--muted-foreground);
  font-size: 0.9rem;
}

.album-heading time {
  display: block;
  margin-top: 0.55rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.admin-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.35rem;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.625rem;
  align-items: start;
}

.photo-grid__column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.625rem;
}

.photo-tile {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  outline: none;
  background: var(--muted);
  box-shadow: none !important;
  text-align: left;
}

.photo-tile:focus-visible {
  outline: 2px solid var(--foreground);
  outline-offset: 3px;
  box-shadow: none !important;
}

.photo-tile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.photo-tile:hover img {
  transform: scale(1.025);
}

.photo-caption {
  position: absolute;
  inset: auto 0.75rem 0.65rem;
  color: white;
  font-size: 0.75rem;
  text-shadow: 0 1px 6px #000;
}

.photo-badge {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  border-radius: 999px;
  background: #b42318;
  color: white;
  padding: 0.3rem 0.55rem;
  font-size: 0.68rem;
}

.gallery-state {
  display: grid;
  min-height: 55vh;
  place-items: center;
  align-content: center;
  gap: 0.65rem;
  color: var(--muted-foreground);
  text-align: center;
}

.gallery-state h1,
.gallery-state h2 {
  color: var(--foreground);
  font-size: 1.5rem;
}

.gallery-state.compact {
  min-height: 12rem;
}

.upload-list {
  margin-bottom: 1rem;
  border-radius: 8px;
  background: var(--muted);
  padding: 0.75rem;
}

.upload-list > div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
  font-size: 0.75rem;
}

.upload-list > div span:first-child {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-failure {
  color: var(--destructive);
}

.upload-success {
  color: #16803c;
}

.load-more,
.load-more-error {
  display: flex;
  justify-content: center;
  padding-top: 1.5rem;
}

.load-more-error {
  align-items: center;
  gap: 0.35rem;
  color: var(--destructive);
  font-size: 0.75rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1100px) {
  .photo-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .album-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .album-list {
    gap: 4rem;
  }

  .photo-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-tile img {
    transition: none;
  }
}
</style>

<!-- DialogContent 会 Teleport 到 body，不能依赖本组件的 scoped 属性选择器。 -->
<style>
.gallery-preview {
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  transform: none !important;
  translate: none !important;
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem);
  gap: 0 !important;
  border-radius: 0 !important;
  padding: 0 !important;
  background: #050505;
  color: white;
}

.gallery-preview .preview-close {
  position: fixed;
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
  z-index: 2;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid rgb(255 255 255 / 20%);
  background: rgb(0 0 0 / 58%);
  color: white;
  backdrop-filter: blur(12px);
}

.gallery-preview .preview-close:hover {
  background: rgb(0 0 0 / 78%);
}

.gallery-preview .preview-close:focus-visible {
  border-color: rgb(255 255 255 / 55%);
  outline: 2px solid rgb(255 255 255 / 85%);
  outline-offset: 2px;
  box-shadow: none !important;
}

.gallery-preview .preview-image {
  display: grid;
  min-width: 0;
  place-items: center;
  overflow: hidden;
  padding: 2rem;
}

.gallery-preview .preview-image img {
  max-width: 100%;
  max-height: calc(100dvh - 4rem);
  object-fit: contain;
}

.gallery-preview .metadata-rail {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
  background: var(--popover);
  color: var(--popover-foreground);
  padding: clamp(1.25rem, 3vw, 2rem);
  padding-top: 4.5rem;
}

.gallery-preview .metadata-title {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.gallery-preview .metadata-title h2 {
  font-size: 1.45rem;
  font-weight: 600;
}

.gallery-preview .metadata-title p {
  margin-top: 0.35rem;
  color: var(--muted-foreground);
}

.gallery-preview .metadata-list {
  display: grid;
  gap: 0.1rem;
}

.gallery-preview .metadata-list div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border);
  padding: 0.6rem 0;
}

.gallery-preview .metadata-list dt {
  color: var(--muted-foreground);
}

.gallery-preview .metadata-list dd {
  text-align: right;
}

@media (max-width: 760px) {
  .gallery-preview {
    overflow-y: auto;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(45dvh, 60dvh) auto;
  }

  .gallery-preview .preview-image {
    padding: 1rem;
  }

  .gallery-preview .preview-image img {
    max-height: 56dvh;
  }

  .gallery-preview .metadata-rail {
    min-height: 40dvh;
    overflow: visible;
    padding-top: 2rem;
  }
}
</style>
