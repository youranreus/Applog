<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue';
import { CameraIcon, ImagePlusIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, UploadIcon } from '@lucide/vue';
import type { IGalleryPhotoDetail, IGalleryPhotoSummary } from '@applog/common';
import { getGalleryPhoto } from '@/api/gallery';
import { USER_ROLES } from '@/constants/permission';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUserStore } from '@/stores/useUserStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGallery } from './useGallery';
import { useSeoHead } from '@/hooks/useSeoHead';

const users = useUserStore(); const layout = useLayoutStore();
const isAdmin = computed(() => users.user?.role === USER_ROLES.ADMIN);
const gallery = useGallery(() => isAdmin.value);
const albumDialog = ref(false); const editingAlbum = ref(false);
const albumForm = reactive({ folder: '', title: '', description: '', publishedAt: '' });
const previewOpen = ref(false); const preview = ref<IGalleryPhotoDetail | null>(null); const previewLoading = ref(false);
const editingPhoto = ref(false); const photoForm = reactive({ title: '', description: '', publishedAt: '', latitude: '', longitude: '' });
const fileInput = ref<HTMLInputElement | null>(null);
const GalleryMap = defineAsyncComponent(() => import('./GalleryMap.vue'));
useSeoHead({ title: '相册', description: '按时间浏览照片与相册', canonicalPath: '/gallery', type: 'website' });

function toLocal(value?: string | null): string { if (!value) return ''; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function iso(value: string): string | undefined { return value ? new Date(value).toISOString() : undefined; }
function openCreate(): void { editingAlbum.value = false; Object.assign(albumForm, { folder: '', title: '', description: '', publishedAt: toLocal(new Date().toISOString()) }); albumDialog.value = true; }
function openEditAlbum(): void { const album = gallery.selectedAlbum.value; if (!album) return; editingAlbum.value = true; Object.assign(albumForm, { folder: album.folder, title: album.title, description: album.description ?? '', publishedAt: toLocal(album.publishedAt) }); albumDialog.value = true; }
async function saveAlbum(): Promise<void> { try { const publishedAt = iso(albumForm.publishedAt); if (editingAlbum.value) await gallery.updateAlbum({ title: albumForm.title, description: albumForm.description || null, ...(publishedAt ? { publishedAt } : {}) }); else await gallery.createAlbum({ folder: albumForm.folder, title: albumForm.title, description: albumForm.description, ...(publishedAt ? { publishedAt } : {}) }); albumDialog.value = false; }
  catch (e) { layout.notify({ title: '保存相册失败', content: e instanceof Error ? e.message : '请稍后重试', type: 'error' }); } }
async function removeAlbum(): Promise<void> { if (!gallery.selectedAlbum.value || !window.confirm(`确定删除空相册“${gallery.selectedAlbum.value.title}”吗？`)) return; try { await gallery.removeAlbum(); } catch (e) { layout.notify({ title: '删除失败', content: e instanceof Error ? e.message : '请稍后重试', type: 'error' }); } }
async function openPhoto(photo: IGalleryPhotoSummary): Promise<void> { previewOpen.value = true; previewLoading.value = true; preview.value = null; editingPhoto.value = false;
  try { preview.value = await getGalleryPhoto(photo.id, isAdmin.value); }
  catch (e) { layout.notify({ title: '照片详情加载失败', content: e instanceof Error ? e.message : '请稍后重试', type: 'error' }); previewOpen.value = false; }
  finally { previewLoading.value = false; } }
function startPhotoEdit(): void { if (!preview.value) return; Object.assign(photoForm, { title: preview.value.title ?? '', description: preview.value.description ?? '', publishedAt: toLocal(preview.value.publishedAt), latitude: preview.value.latitude?.toString() ?? '', longitude: preview.value.longitude?.toString() ?? '' }); editingPhoto.value = true; }
async function savePhoto(): Promise<void> { if (!preview.value) return; try { const latitude = photoForm.latitude.trim() === '' ? null : Number(photoForm.latitude); const longitude = photoForm.longitude.trim() === '' ? null : Number(photoForm.longitude);
    await gallery.updatePhoto(preview.value.id, { title: photoForm.title || null, description: photoForm.description || null, publishedAt: iso(photoForm.publishedAt), latitude, longitude });
    preview.value = await getGalleryPhoto(preview.value.id, true); editingPhoto.value = false;
  } catch (e) { layout.notify({ title: '照片信息保存失败', content: e instanceof Error ? e.message : '请稍后重试', type: 'error' }); } }
async function removePhoto(): Promise<void> { if (!preview.value || !window.confirm('确定删除这张照片及其 OSS 对象吗？')) return; try { await gallery.removePhoto(preview.value.id); previewOpen.value = false; } catch (e) { layout.notify({ title: '删除失败', content: e instanceof Error ? e.message : '可稍后重试', type: 'error' }); await gallery.loadPhotos(false); } }
async function upload(event: Event): Promise<void> { const input = event.target as HTMLInputElement; if (!input.files?.length) return; try { await gallery.uploadFiles(input.files); } catch (e) { layout.notify({ title: '无法开始上传', content: e instanceof Error ? e.message : '请检查文件', type: 'error' }); } finally { input.value = ''; } }
const hasGps = computed(() => preview.value?.latitude != null && preview.value?.longitude != null);
watch(previewOpen, (open) => { if (!open) { preview.value = null; editingPhoto.value = false; } });
onMounted(gallery.load);
</script>

<template>
  <div class="gallery-root">
  <main class="gallery-page">
    <section v-if="gallery.loading.value" class="gallery-state"><CameraIcon class="size-7" /><p>正在打开相册…</p></section>
    <section v-else-if="gallery.error.value" class="gallery-state"><p>{{ gallery.error.value }}</p><Button variant="outline" @click="gallery.load"><RefreshCwIcon />重试</Button></section>
    <section v-else-if="!gallery.enabled.value" class="gallery-state"><CameraIcon class="size-8" /><h1>相册暂未开放</h1><p>管理员启用并验证存储配置后，这里会出现照片。</p></section>
    <template v-else>
      <header class="gallery-hero">
        <div><p class="gallery-kicker">GALLERY</p><h1>相册</h1><p>沿着时间，慢慢翻看留下来的光。</p></div>
        <Button v-if="isAdmin" variant="outline" @click="openCreate"><PlusIcon />新建相册</Button>
      </header>
      <nav v-if="gallery.albums.value.length" class="album-rail" aria-label="相册列表">
        <button v-for="album in gallery.albums.value" :key="album.id" type="button" :class="['album-tab', { active: album.id === gallery.selectedId.value }]" @click="gallery.selectAlbum(album.id)">
          <span>{{ album.title }}</span><small>{{ new Date(album.publishedAt).getFullYear() }} · {{ album.photoCount }} 张</small>
        </button>
      </nav>
      <section v-if="!gallery.selectedAlbum.value" class="gallery-state compact"><ImagePlusIcon class="size-7" /><h2>还没有相册</h2><p v-if="isAdmin">创建第一本相册，再把照片放进来。</p></section>
      <section v-else class="album-window">
        <header class="album-heading">
          <div><h2>{{ gallery.selectedAlbum.value.title }}</h2><p v-if="gallery.selectedAlbum.value.description">{{ gallery.selectedAlbum.value.description }}</p><time>{{ new Date(gallery.selectedAlbum.value.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) }}</time></div>
          <div v-if="isAdmin" class="admin-actions"><Button variant="outline" :disabled="gallery.uploadBusy.value" @click="fileInput?.click()"><UploadIcon />上传照片</Button><Button variant="ghost" size="icon" aria-label="编辑相册" @click="openEditAlbum"><PencilIcon /></Button><Button variant="destructive" size="icon" aria-label="删除空相册" :disabled="gallery.selectedAlbum.value.photoCount > 0" @click="removeAlbum"><Trash2Icon /></Button><input ref="fileInput" class="sr-only" type="file" multiple :disabled="gallery.uploadBusy.value" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif" @change="upload" /></div>
        </header>
        <div v-if="gallery.uploads.value.length" class="upload-list" aria-live="polite"><div v-for="item in gallery.uploads.value" :key="item.id"><span>{{ item.file.name }}</span><span :class="`upload-${item.state}`">{{ { queued: '等待', uploading: '上传中', success: '完成', failure: item.error || '失败' }[item.state] }}</span><Button v-if="item.state === 'failure'" variant="link" size="xs" @click="gallery.retryUpload(item)">重试</Button></div></div>
        <div v-if="gallery.photosLoading.value && !gallery.photos.value.length" class="gallery-state compact">正在读取照片…</div>
        <div v-else-if="!gallery.photos.value.length" class="gallery-state compact"><p>这本相册还是空的。</p><Button v-if="isAdmin" variant="outline" :disabled="gallery.uploadBusy.value" @click="fileInput?.click()"><UploadIcon />上传第一张</Button></div>
        <div v-else class="photo-grid"><button v-for="photo in gallery.photos.value" :key="photo.id" type="button" class="photo-tile" @click="openPhoto(photo)"><img :src="photo.displayUrl" :alt="photo.title || '相册照片'" loading="lazy" /><span v-if="photo.storageState === 'delete_failed'" class="photo-badge">删除失败 · 点开重试</span><span class="photo-caption">{{ photo.title || new Date(photo.publishedAt).toLocaleDateString('zh-CN') }}</span></button></div>
        <div v-if="gallery.nextCursor.value" class="load-more"><Button variant="outline" :disabled="gallery.photosLoading.value" @click="gallery.loadPhotos(true)">加载更多</Button></div>
      </section>
    </template>
  </main>

  <Dialog v-if="isAdmin" v-model:open="albumDialog"><DialogContent><DialogHeader><DialogTitle>{{ editingAlbum ? '编辑相册' : '新建相册' }}</DialogTitle><DialogDescription>相册目录创建后不可修改，展示标题可以随时更新。</DialogDescription></DialogHeader><Field><FieldLabel>标题</FieldLabel><Input v-model="albumForm.title" /></Field><Field><FieldLabel>目录</FieldLabel><Input v-model="albumForm.folder" :disabled="editingAlbum" placeholder="travel-2026" /></Field><Field><FieldLabel>描述</FieldLabel><Textarea v-model="albumForm.description" /></Field><Field><FieldLabel>发布时间</FieldLabel><Input v-model="albumForm.publishedAt" type="datetime-local" /></Field><DialogFooter><Button variant="outline" @click="albumDialog = false">取消</Button><Button @click="saveAlbum">保存</Button></DialogFooter></DialogContent></Dialog>

  <Dialog v-model:open="previewOpen"><DialogContent class="gallery-preview" overlay-class="bg-black/90"><DialogTitle class="sr-only">{{ preview?.title || '照片详情' }}</DialogTitle><div v-if="previewLoading" class="grid h-full place-items-center text-white/70">正在加载照片…</div><template v-else-if="preview"><div class="preview-image"><img :src="preview.displayUrl" :alt="preview.title || '相册照片'" /></div><aside class="metadata-rail"><div class="metadata-title"><div><h2>{{ preview.title || '未命名照片' }}</h2><p>{{ preview.description || '没有文字说明' }}</p></div><Button v-if="isAdmin" variant="ghost" size="icon" aria-label="编辑照片" @click="startPhotoEdit"><PencilIcon /></Button></div><template v-if="editingPhoto"><Field><FieldLabel>标题</FieldLabel><Input v-model="photoForm.title" /></Field><Field><FieldLabel>描述</FieldLabel><Textarea v-model="photoForm.description" /></Field><Field><FieldLabel>发布时间</FieldLabel><Input v-model="photoForm.publishedAt" type="datetime-local" /></Field><div class="grid grid-cols-2 gap-2"><Field><FieldLabel>纬度</FieldLabel><Input v-model="photoForm.latitude" type="number" step="any" /></Field><Field><FieldLabel>经度</FieldLabel><Input v-model="photoForm.longitude" type="number" step="any" /></Field></div><div class="flex gap-2"><Button @click="savePhoto">保存</Button><Button variant="outline" @click="editingPhoto = false">取消</Button></div></template><template v-else><dl class="metadata-list"><div><dt>发布时间</dt><dd>{{ new Date(preview.publishedAt).toLocaleString('zh-CN') }}</dd></div><div v-if="preview.takenAt"><dt>拍摄时间</dt><dd>{{ new Date(preview.takenAt).toLocaleString('zh-CN') }}</dd></div><div><dt>尺寸</dt><dd>{{ preview.width }} × {{ preview.height }}</dd></div><div v-if="preview.exif?.make || preview.exif?.model"><dt>相机</dt><dd>{{ [preview.exif?.make, preview.exif?.model].filter(Boolean).join(' ') }}</dd></div><div v-if="preview.exif?.lensModel"><dt>镜头</dt><dd>{{ preview.exif.lensModel }}</dd></div><div v-if="preview.exif?.aperture"><dt>光圈</dt><dd>ƒ/{{ preview.exif.aperture }}</dd></div><div v-if="preview.exif?.exposureTime"><dt>快门</dt><dd>{{ preview.exif.exposureTime }}s</dd></div><div v-if="preview.exif?.iso"><dt>ISO</dt><dd>{{ preview.exif.iso }}</dd></div></dl><div v-if="hasGps" class="space-y-2"><GalleryMap :latitude="preview.latitude!" :longitude="preview.longitude!" /><p class="text-xs text-muted-foreground">{{ preview.latitude?.toFixed(6) }}, {{ preview.longitude?.toFixed(6) }}</p></div><div v-if="isAdmin" class="mt-auto"><Button variant="destructive" @click="removePhoto"><Trash2Icon />{{ preview.storageState === 'delete_failed' ? '重试删除' : '删除照片' }}</Button></div></template></aside></template></DialogContent></Dialog>
  </div>
</template>

<style scoped>
.gallery-page{width:min(1440px,100%);margin:0 auto;padding:clamp(2rem,5vw,5rem) clamp(1rem,4vw,4rem) 6rem}.gallery-hero{display:flex;align-items:end;justify-content:space-between;gap:2rem;margin-bottom:2.5rem}.gallery-kicker{margin-bottom:.45rem;color:var(--color-link-blue);font-size:.72rem;font-weight:700;letter-spacing:.22em}.gallery-hero h1{font-family:var(--font-heading);font-size:clamp(3rem,8vw,7.5rem);font-weight:600;line-height:.88;letter-spacing:-.065em}.gallery-hero p:last-child{margin-top:1rem;color:var(--muted-foreground)}.album-rail{display:flex;gap:.35rem;overflow-x:auto;padding:.35rem 0 1.5rem;scrollbar-width:none}.album-tab{min-width:max-content;border:0;border-radius:999px;background:transparent;padding:.65rem 1rem;text-align:left;color:var(--muted-foreground);transition:.2s}.album-tab span,.album-tab small{display:block}.album-tab small{font-size:.67rem;opacity:.75}.album-tab.active{background:var(--foreground);color:var(--background)}.album-window{min-height:45vh}.album-heading{display:flex;align-items:start;justify-content:space-between;gap:1.5rem;margin:1.5rem 0}.album-heading h2{font-size:clamp(1.8rem,4vw,3.2rem);font-weight:550;letter-spacing:-.035em}.album-heading p{max-width:42rem;margin-top:.45rem;color:var(--muted-foreground)}.album-heading time{display:block;margin-top:.65rem;font-size:.75rem;color:var(--muted-foreground)}.admin-actions{display:flex;gap:.35rem}.photo-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(.5rem,1.2vw,1rem)}.photo-tile{position:relative;grid-column:span 4;aspect-ratio:4/3;overflow:hidden;border:0;border-radius:1rem;background:var(--muted);text-align:left}.photo-tile:nth-child(7n+1),.photo-tile:nth-child(7n+5){grid-column:span 8;aspect-ratio:16/9}.photo-tile img{width:100%;height:100%;object-fit:cover;transition:transform .5s cubic-bezier(.2,.8,.2,1)}.photo-tile:hover img{transform:scale(1.025)}.photo-caption{position:absolute;inset:auto .75rem .65rem;color:white;font-size:.75rem;text-shadow:0 1px 6px #000}.photo-badge{position:absolute;top:.6rem;left:.6rem;border-radius:999px;background:#b42318;color:white;padding:.3rem .55rem;font-size:.68rem}.gallery-state{display:grid;min-height:55vh;place-items:center;align-content:center;gap:.65rem;text-align:center;color:var(--muted-foreground)}.gallery-state h1,.gallery-state h2{color:var(--foreground);font-size:1.5rem}.gallery-state.compact{min-height:15rem}.upload-list{margin:0 0 1rem;border-radius:1rem;background:var(--muted);padding:.75rem}.upload-list>div{display:flex;align-items:center;gap:.5rem;padding:.25rem;font-size:.75rem}.upload-list>div span:first-child{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.upload-failure{color:var(--destructive)}.upload-success{color:#16803c}.load-more{display:flex;justify-content:center;padding:2rem}.gallery-preview{top:0;left:0;width:100vw;height:100dvh;max-width:none!important;transform:none;border-radius:0;padding:0;gap:0;background:#050505;color:white;grid-template-columns:minmax(0,1fr) minmax(20rem,26rem)}.preview-image{display:grid;min-width:0;place-items:center;overflow:hidden;padding:2rem}.preview-image img{max-width:100%;max-height:calc(100dvh - 4rem);object-fit:contain}.metadata-rail{display:flex;min-height:0;flex-direction:column;gap:1.25rem;overflow-y:auto;background:var(--popover);color:var(--popover-foreground);padding:clamp(1.25rem,3vw,2rem)}.metadata-title{display:flex;justify-content:space-between;gap:1rem;padding-right:2rem}.metadata-title h2{font-size:1.45rem;font-weight:600}.metadata-title p{margin-top:.35rem;color:var(--muted-foreground)}.metadata-list{display:grid;gap:.1rem}.metadata-list div{display:flex;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--border);padding:.6rem 0}.metadata-list dt{color:var(--muted-foreground)}.metadata-list dd{text-align:right}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:760px){.gallery-page{padding-top:2rem}.gallery-hero{align-items:start}.photo-tile,.photo-tile:nth-child(7n+1),.photo-tile:nth-child(7n+5){grid-column:span 6;aspect-ratio:1}.album-heading{flex-direction:column}.gallery-preview{overflow-y:auto;grid-template-columns:1fr;grid-template-rows:minmax(45dvh,60dvh) auto}.preview-image{padding:1rem}.preview-image img{max-height:56dvh}.metadata-rail{overflow:visible;min-height:40dvh}}
@media(prefers-reduced-motion:reduce){.photo-tile img{transition:none}}
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
}
.gallery-preview .metadata-title {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-right: 2rem;
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
  }
}
</style>
