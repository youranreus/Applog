<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from 'vue'
import { PencilIcon, Trash2Icon, XIcon } from '@lucide/vue'
import type { IGalleryPhotoDetail, IUpdateGalleryPhoto } from '@applog/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLayoutStore } from '@/stores/useLayoutStore'

interface Props {
  photoId: string | null
  isAdmin: boolean
  loadPhoto: (photoId: string) => Promise<IGalleryPhotoDetail>
  updatePhoto: (albumId: string, photoId: string, value: IUpdateGalleryPhoto) => Promise<void>
  removePhoto: (albumId: string, photoId: string) => Promise<void>
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const layout = useLayoutStore()
const preview = ref<IGalleryPhotoDetail | null>(null)
const previewLoading = ref(false)
const editingPhoto = ref(false)
const loadRevision = ref(0)
const photoForm = reactive({
  title: '',
  description: '',
  publishedAt: '',
  latitude: '',
  longitude: '',
})
const GalleryMap = defineAsyncComponent(() => import('./GalleryMap.vue'))

function toLocal(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function iso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

async function loadPreview(): Promise<void> {
  const photoId = props.photoId
  if (!open.value || !photoId) return

  const revision = ++loadRevision.value
  previewLoading.value = true
  preview.value = null
  editingPhoto.value = false
  try {
    const detail = await props.loadPhoto(photoId)
    if (revision === loadRevision.value && open.value) preview.value = detail
  } catch (cause) {
    if (revision !== loadRevision.value) return
    layout.notify({
      title: '照片详情加载失败',
      content: cause instanceof Error ? cause.message : '请稍后重试',
      type: 'error',
    })
    open.value = false
  } finally {
    if (revision === loadRevision.value) previewLoading.value = false
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
  const currentPhoto = preview.value
  if (!currentPhoto) return
  try {
    const latitude = photoForm.latitude.trim() === '' ? null : Number(photoForm.latitude)
    const longitude = photoForm.longitude.trim() === '' ? null : Number(photoForm.longitude)
    await props.updatePhoto(currentPhoto.albumId, currentPhoto.id, {
      title: photoForm.title || null,
      description: photoForm.description || null,
      publishedAt: iso(photoForm.publishedAt),
      latitude,
      longitude,
    })
    if (!open.value || props.photoId !== currentPhoto.id) return
    const detail = await props.loadPhoto(currentPhoto.id)
    if (!open.value || props.photoId !== currentPhoto.id) return
    preview.value = detail
    editingPhoto.value = false
  } catch (cause) {
    layout.notify({
      title: '照片信息保存失败',
      content: cause instanceof Error ? cause.message : '请稍后重试',
      type: 'error',
    })
  }
}

async function removeCurrentPhoto(): Promise<void> {
  const currentPhoto = preview.value
  if (!currentPhoto || !window.confirm('确定删除这张照片及其 OSS 对象吗？')) return
  try {
    await props.removePhoto(currentPhoto.albumId, currentPhoto.id)
    if (props.photoId === currentPhoto.id) open.value = false
  } catch (cause) {
    layout.notify({
      title: '删除失败',
      content: cause instanceof Error ? cause.message : '可稍后重试',
      type: 'error',
    })
    if (open.value && props.photoId === currentPhoto.id) await loadPreview()
  }
}

const hasGps = computed(() => preview.value?.latitude != null && preview.value?.longitude != null)

watch([open, () => props.photoId], ([isOpen]) => {
  if (isOpen) {
    void loadPreview()
  } else {
    loadRevision.value++
    preview.value = null
    editingPhoto.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      fullscreen
      class="gallery-preview"
      overlay-class="bg-black/90"
      :show-close-button="false"
    >
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
            <Field><FieldLabel>描述</FieldLabel><Textarea v-model="photoForm.description" /></Field>
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
              <Button variant="destructive" @click="removeCurrentPhoto">
                <Trash2Icon />
                {{ preview.storageState === 'delete_failed' ? '重试删除' : '删除照片' }}
              </Button>
            </div>
          </template>
        </aside>
      </template>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
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
</style>

<!-- DialogContent 会 Teleport 到 body，不能依赖本组件的 scoped 属性选择器。 -->
<style>
.gallery-preview {
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem);
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
