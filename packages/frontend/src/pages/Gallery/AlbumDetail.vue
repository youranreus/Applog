<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import {
  ArrowLeftIcon,
  CameraIcon,
  ImagePlusIcon,
  RefreshCwIcon,
  UploadIcon,
} from '@lucide/vue'
import type { IGalleryPhotoSummary } from '@applog/common'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ROUTE_NAMES, USER_ROLES } from '@/constants/permission'
import { useSeoHead } from '@/hooks/useSeoHead'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { useUserStore } from '@/stores/useUserStore'
import PhotoPreview from './PhotoPreview.vue'
import { useGallery } from './useGallery'

const route = useRoute()
const users = useUserStore()
const layout = useLayoutStore()
const isAdmin = computed(() => users.user?.role === USER_ROLES.ADMIN)
const gallery = useGallery(() => isAdmin.value)
const isMultiColumn = useMediaQuery('(min-width: 701px)')
const isThreeColumn = useMediaQuery('(min-width: 1101px)')
const fileInput = ref<HTMLInputElement | null>(null)
const previewOpen = ref(false)
const selectedPhotoId = ref<string | null>(null)
const albumId = computed(() => {
  const value = route.params.albumId
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
})
const album = computed(() =>
  gallery.albums.value.find((candidate) => candidate.id === albumId.value),
)
const photosState = computed(() => gallery.albumPhotos[albumId.value])

const photoColumns = computed<IGalleryPhotoSummary[][]>(() => {
  const count = isThreeColumn.value ? 3 : isMultiColumn.value ? 2 : 1
  const columns: IGalleryPhotoSummary[][] = Array.from({ length: count }, () => [])
  const columnHeights = Array.from({ length: count }, () => 0)
  for (const photo of photosState.value?.items ?? []) {
    const shortestHeight = Math.min(...columnHeights)
    const columnIndex = columnHeights.indexOf(shortestHeight)
    columns[columnIndex]?.push(photo)
    columnHeights[columnIndex] =
      (columnHeights[columnIndex] ?? 0) + photo.height / Math.max(photo.width, 1)
  }
  return columns
})

useSeoHead({
  title: computed(() => (album.value ? `${album.value.title} - 相册` : '相册详情')),
  description: computed(() => album.value?.description || '浏览相册中的照片'),
  image: computed(() => album.value?.coverUrl ?? undefined),
  canonicalPath: computed(() => `/gallery/${albumId.value}`),
  type: 'website',
})

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function loadDetail(): Promise<void> {
  const requestedAlbumId = albumId.value
  await gallery.load()
  if (
    requestedAlbumId !== albumId.value ||
    gallery.error.value ||
    !gallery.enabled.value ||
    !gallery.albums.value.some((candidate) => candidate.id === requestedAlbumId)
  ) {
    return
  }
  await gallery.loadPhotos(requestedAlbumId)
}

function beginUpload(): void {
  fileInput.value?.click()
}

async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  try {
    await gallery.uploadFiles(albumId.value, input.files)
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

function openPhoto(photo: IGalleryPhotoSummary): void {
  selectedPhotoId.value = photo.id
  previewOpen.value = true
}

watch(albumId, () => void loadDetail(), { immediate: true })
</script>

<template>
  <div class="gallery-detail-root">
    <main class="gallery-detail-page">
      <section v-if="gallery.loading.value" class="gallery-state">
        <CameraIcon class="size-7" />
        <p>正在打开相册…</p>
      </section>
      <section v-else-if="gallery.error.value" class="gallery-state">
        <p>{{ gallery.error.value }}</p>
        <Button variant="outline" @click="loadDetail"><RefreshCwIcon />重试</Button>
        <RouterLink :to="{ name: ROUTE_NAMES.GALLERY }" class="gallery-back-link">
          返回相册列表
        </RouterLink>
      </section>
      <section v-else-if="!gallery.enabled.value" class="gallery-state">
        <CameraIcon class="size-8" />
        <h1>相册暂未开放</h1>
        <p>管理员启用并验证存储配置后，这里会出现照片。</p>
        <RouterLink :to="{ name: ROUTE_NAMES.GALLERY }" class="gallery-back-link">
          返回相册列表
        </RouterLink>
      </section>
      <section v-else-if="!album" class="gallery-state">
        <ImagePlusIcon class="size-8" />
        <h1>没有找到这本相册</h1>
        <p>它可能已被删除，或暂时不可见。</p>
        <Button as-child variant="outline">
          <RouterLink :to="{ name: ROUTE_NAMES.GALLERY }">
            <ArrowLeftIcon />返回相册列表
          </RouterLink>
        </Button>
      </section>
      <template v-else>
        <header class="album-heading">
          <div class="album-heading__copy">
            <RouterLink :to="{ name: ROUTE_NAMES.GALLERY }" class="gallery-back-link">
              <ArrowLeftIcon />相册列表
            </RouterLink>
            <h1>{{ album.title }}</h1>
            <p v-if="album.description">{{ album.description }}</p>
            <time :datetime="album.publishedAt">
              {{ formatDate(album.publishedAt) }} · {{ album.photoCount }} 张
            </time>
          </div>
          <Button
            v-if="isAdmin"
            variant="outline"
            :disabled="gallery.uploadBusy.value"
            @click="beginUpload"
          >
            <UploadIcon />上传照片
          </Button>
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

        <section
          v-if="photosState?.loading && !photosState.items.length"
          class="gallery-state compact"
        >
          <p>正在读取照片…</p>
        </section>
        <section
          v-else-if="photosState?.error && !photosState.items.length"
          class="gallery-state compact"
        >
          <p>{{ photosState.error }}</p>
          <Button variant="outline" size="sm" @click="gallery.loadPhotos(album.id)">
            <RefreshCwIcon />重试
          </Button>
        </section>
        <section v-else-if="!photosState?.items.length" class="gallery-state compact">
          <ImagePlusIcon class="size-7" />
          <p>这本相册还是空的。</p>
          <Button
            v-if="isAdmin"
            variant="outline"
            :disabled="gallery.uploadBusy.value"
            @click="beginUpload"
          >
            <UploadIcon />上传第一张
          </Button>
        </section>
        <section v-else class="photo-grid" aria-label="相册照片">
          <div
            v-for="(column, columnIndex) in photoColumns"
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
        </section>

        <div v-if="photosState?.error && photosState.items.length" class="load-more-error" role="alert">
          <span>{{ photosState.error }}</span>
          <Button
            variant="link"
            size="xs"
            @click="gallery.loadPhotos(album.id, photosState.retryAppend)"
          >
            重试
          </Button>
        </div>
        <div v-else-if="photosState?.nextCursor" class="load-more">
          <Button
            variant="outline"
            :disabled="photosState.loading"
            @click="gallery.loadPhotos(album.id, true)"
          >
            {{ photosState.loading ? '加载中…' : '加载更多' }}
          </Button>
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

    <PhotoPreview
      v-model:open="previewOpen"
      :photo-id="selectedPhotoId"
      :is-admin="isAdmin"
      :load-photo="gallery.loadPhoto"
      :update-photo="gallery.updatePhoto"
      :remove-photo="gallery.removePhoto"
    />
  </div>
</template>

<style scoped>
.gallery-detail-page {
  box-sizing: border-box;
  width: 100%;
  padding: 0 clamp(0.75rem, 2vw, 2rem) 5rem;
  padding-top: calc(clamp(6.5rem, 10vh, 8rem) + env(safe-area-inset-top));
}

.album-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
}

.album-heading__copy {
  min-width: 0;
}

.album-heading h1 {
  margin-top: 1rem;
  font-family: var(--font-heading);
  font-size: clamp(1.75rem, 1.35rem + 1.3vw, 2.5rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.album-heading p {
  max-width: 48rem;
  margin-top: 0.5rem;
  color: var(--muted-foreground);
  font-size: 0.9rem;
}

.album-heading time {
  display: block;
  margin-top: 0.55rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.gallery-back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 4px;
  color: var(--color-link-blue);
  font-size: 0.8rem;
  outline: none;
}

.gallery-back-link svg {
  width: 0.9rem;
  height: 0.9rem;
}

.gallery-back-link:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: clamp(0.5rem, 0.8vw, 0.75rem);
  width: 100%;
}

.photo-grid__column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: clamp(0.5rem, 0.8vw, 0.75rem);
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
  padding: 0;
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
  right: 0.75rem;
  bottom: 0.65rem;
  left: 0.75rem;
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

.gallery-state h1 {
  color: var(--foreground);
  font-size: 1.5rem;
}

.gallery-state.compact {
  min-height: 16rem;
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
