<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  CameraIcon,
  ImageIcon,
  ImagePlusIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from '@lucide/vue'
import type { IGalleryAlbumSummary } from '@applog/common'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ROUTE_NAMES, USER_ROLES } from '@/constants/permission'
import { useSeoHead } from '@/hooks/useSeoHead'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { useUserStore } from '@/stores/useUserStore'
import { useGallery } from './useGallery'

const users = useUserStore()
const layout = useLayoutStore()
const router = useRouter()
const isAdmin = computed(() => users.user?.role === USER_ROLES.ADMIN)
const gallery = useGallery(() => isAdmin.value)
const albumDialog = ref(false)
const editingAlbumId = ref<string | null>(null)
const albumForm = reactive({ folder: '', title: '', description: '', publishedAt: '' })

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

function openAlbum(albumId: string): void {
  void router.push({ name: ROUTE_NAMES.GALLERY_ALBUM, params: { albumId } })
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
          <Button variant="outline" @click="openCreate"><PlusIcon />新建相册</Button>
        </div>

        <section v-if="!gallery.albums.value.length" class="gallery-state compact">
          <ImagePlusIcon class="size-7" />
          <h1>还没有相册</h1>
          <p v-if="isAdmin">创建第一本相册，再把照片放进来。</p>
          <p v-else>新的相册会在这里与你见面。</p>
          <Button v-if="isAdmin" variant="outline" @click="openCreate">
            <PlusIcon />创建相册
          </Button>
        </section>

        <section v-else class="album-grid" aria-label="相册列表">
          <article v-for="album in gallery.albums.value" :key="album.id" class="album-card">
            <RouterLink
              class="album-card__link"
              :to="{ name: ROUTE_NAMES.GALLERY_ALBUM, params: { albumId: album.id } }"
              :aria-label="`打开相册 ${album.title}`"
              @keydown.space.prevent="openAlbum(album.id)"
            >
              <img
                v-if="album.coverUrl"
                :src="album.coverUrl"
                :alt="`${album.title}封面`"
                loading="lazy"
              />
              <div v-else class="album-card__placeholder" aria-hidden="true">
                <ImageIcon />
                <span>暂无封面</span>
              </div>
              <span class="album-card__scrim" aria-hidden="true"></span>
              <span class="album-card__caption">
                <strong>{{ album.title }}</strong>
                <time :datetime="album.publishedAt">{{ formatDate(album.publishedAt) }}</time>
              </span>
            </RouterLink>

            <div v-if="isAdmin" class="album-card__actions">
              <Button
                variant="secondary"
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
          </article>
        </section>
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
        <Field><FieldLabel>描述</FieldLabel><Textarea v-model="albumForm.description" /></Field>
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
  </div>
</template>

<style scoped>
.gallery-page {
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 0 clamp(1.5rem, 4vw, 3rem) 5rem;
  padding-top: calc(clamp(6.5rem, 10vh, 8rem) + env(safe-area-inset-top));
}

.gallery-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
}

.album-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(0.75rem, 1.4vw, 1.25rem);
}

.album-card {
  position: relative;
  min-width: 0;
  aspect-ratio: 4 / 3;
}

.album-card__link {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 8px;
  outline: none;
  background: var(--muted);
}

.album-card__link:focus-visible {
  outline: 2px solid var(--foreground);
  outline-offset: 3px;
}

.album-card__link img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.album-card__link:hover img {
  transform: scale(1.025);
}

.album-card__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  align-content: center;
  gap: 0.5rem;
  color: var(--muted-foreground);
  background: linear-gradient(145deg, var(--muted), var(--accent));
  font-size: 0.75rem;
}

.album-card__placeholder svg {
  width: 2rem;
  height: 2rem;
}

.album-card__scrim {
  position: absolute;
  inset: 36% 0 0;
  background: linear-gradient(to bottom, transparent, rgb(0 0 0 / 68%));
  pointer-events: none;
}

.album-card__caption {
  position: absolute;
  right: 1rem;
  bottom: 0.9rem;
  left: 1rem;
  display: grid;
  gap: 0.15rem;
  color: white;
  text-shadow: 0 1px 8px rgb(0 0 0 / 65%);
}

.album-card__caption strong {
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-card__caption time {
  font-size: 0.72rem;
  opacity: 0.84;
}

.album-card__actions {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  z-index: 1;
  display: flex;
  gap: 0.35rem;
}

.album-card__actions button {
  border: 1px solid rgb(255 255 255 / 28%);
  box-shadow: none;
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
  min-height: 18rem;
}

@media (min-width: 640px) {
  .album-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .album-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .album-card__link img {
    transition: none;
  }
}
</style>
