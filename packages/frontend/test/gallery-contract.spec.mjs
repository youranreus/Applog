import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'

describe('gallery frontend cross-layer contract', () => {
  it('registers list and detail routes while keeping navigation fail closed', async () => {
    const [router, permission, nav, store] = await Promise.all([
      readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/constants/permission.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/constants/nav.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/stores/useLayoutStore/index.ts', import.meta.url), 'utf8'),
    ])
    assert.match(router, /path: '\/gallery'/)
    assert.match(router, /path: '\/gallery\/:albumId'/)
    assert.match(router, /Gallery\/AlbumDetail\.vue/)
    assert.match(permission, /GALLERY_ALBUM: 'galleryAlbum'/)
    assert.match(nav, /route: \{ name: ROUTE_NAMES\.GALLERY \}/)
    assert.match(nav, /ROUTE_NAMES\.GALLERY_ALBUM/)
    assert.match(store, /galleryStatus\.value\?\.enabled === true/)
    assert.match(store, /!galleryStatusError\.value/)
    assert.match(store, /initialData: \{ enabled: false \}/)
  })

  it('renders summary cards on the list route without photo-list behavior', async () => {
    const [page, hook] = await Promise.all([
      readFile(new URL('../src/pages/Gallery/index.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Gallery/useGallery.ts', import.meta.url), 'utf8'),
    ])
    const listLoad = hook.slice(
      hook.indexOf('async function load()'),
      hook.indexOf('async function loadPhotos'),
    )
    assert.match(page, /class="album-grid"/)
    assert.match(page, /album\.coverUrl/)
    assert.match(page, /ROUTE_NAMES\.GALLERY_ALBUM/)
    assert.match(page, /class="album-card__caption"/)
    assert.match(page, /border-radius: 8px/)
    assert.match(page, /\.album-card__link:focus-visible/)
    assert.match(page, /@keydown\.space\.prevent="openAlbum\(album\.id\)"/)
    assert.match(page, /openCreate/)
    assert.match(page, /openEditAlbum/)
    assert.match(page, /removeAlbum/)
    assert.doesNotMatch(page, /loadPhotos/)
    assert.doesNotMatch(page, /photo-grid/)
    assert.doesNotMatch(page, /上传照片/)
    assert.doesNotMatch(listLoad, /loadPhotos\(/)
    assert.doesNotMatch(hook, /nextAlbums\.map\(\(album\) => loadPhotos/)
    assert.match(hook, /const revision = \+\+loadRevision/)
    assert.match(hook, /if \(revision !== loadRevision\) return/)
    assert.match(hook, /revision !== albumLoadRevision \|\| !isCurrent\(\)/)
    assert.doesNotMatch(page, /box-shadow: 0 2px 12px/)
  })

  it('loads only the selected album on the detail route and owns photo mutations there', async () => {
    const [detail, preview, api, hook] = await Promise.all([
      readFile(new URL('../src/pages/Gallery/AlbumDetail.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Gallery/PhotoPreview.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/api/gallery/index.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Gallery/useGallery.ts', import.meta.url), 'utf8'),
    ])
    assert.match(detail, /route\.params\.albumId/)
    assert.match(detail, /gallery\.loadPhotos\(requestedAlbumId\)/)
    assert.match(detail, /watch\(albumId/)
    assert.match(detail, /没有找到这本相册/)
    assert.match(detail, /上传照片/)
    assert.match(detail, /gallery\.retryUpload\(item\)/)
    assert.match(detail, /<PhotoPreview/)
    assert.match(preview, /GalleryMap/)
    assert.match(preview, /preview\.exif/)
    assert.match(preview, /删除照片/)
    assert.match(api, /\/gallery\/admin\/albums/)
    assert.match(hook, /Promise\.all\(\[worker\(\), worker\(\)\]\)/)
    assert.match(hook, /GALLERY_MAX_BATCH_SIZE/)
    assert.match(hook, /uploadGalleryPhoto\(item\.albumId, item\.file\)/)
    assert.match(hook, /uploadBusy/)
    assert.match(hook, /let photoLoadRevision = 0/)
    assert.match(hook, /const revision = \+\+photoLoadRevision/)
    assert.match(hook, /photoLoadRevisions\.set\(albumId, revision\)/)
    assert.equal(
      hook.match(/photoLoadRevisions\.get\(albumId\) !== revision/g)?.length,
      2,
    )
    assert.match(
      hook,
      /if \(photoLoadRevisions\.get\(albumId\) === revision\) state\.loading = false/,
    )
    assert.ok(
      (hook.match(/photoLoadRevisions\.delete\(albumId\)/g)?.length ?? 0) >= 2,
      'clearing or removing an album must invalidate its in-flight photo request',
    )
    assert.doesNotMatch(hook, /\(photoLoadRevisions\.get\(albumId\) \?\? 0\) \+ 1/)
    assert.match(
      hook,
      /async function updatePhoto[\s\S]*?Promise\.allSettled\(\[loadAlbums\(\), loadPhotos\(albumId\)\]\)/,
    )
    assert.match(hook, /item\.state = 'success'[\s\S]*?Promise\.allSettled/)
  })

  it('keeps a full-width responsive masonry and explicit full-screen preview controls', async () => {
    const [list, detail, preview, dialogContent] = await Promise.all([
      readFile(new URL('../src/pages/Gallery/index.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Gallery/AlbumDetail.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Gallery/PhotoPreview.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/components/ui/dialog/DialogContent.vue', import.meta.url), 'utf8'),
    ])
    const safeAreaTop =
      /padding-top: calc\(clamp\(6\.5rem, 10vh, 8rem\) \+ env\(safe-area-inset-top\)\)/
    assert.match(list, safeAreaTop)
    assert.match(detail, safeAreaTop)
    assert.match(detail, /\.gallery-detail-page[\s\S]*?width: 100%/)
    assert.doesNotMatch(detail, /max-width: 80rem/)
    assert.match(detail, /photo-grid__column/)
    assert.match(detail, /photo\.height \/ Math\.max\(photo\.width, 1\)/)
    assert.match(detail, /isThreeColumn\.value \? 3/)
    assert.match(detail, /grid-template-columns: repeat\(3/)
    assert.match(detail, /grid-template-columns: repeat\(2/)
    assert.match(detail, /grid-template-columns: minmax\(0, 1fr\)/)
    assert.match(detail, /\.photo-tile:focus-visible/)
    assert.match(preview, /:show-close-button="false"/)
    assert.match(preview, /aria-label="关闭照片预览"/)
    assert.match(preview, /<DialogContent[\s\S]*?fullscreen/)
    assert.doesNotMatch(preview, /translate: none !important/)
    assert.match(dialogContent, /fullscreen\?: boolean/)
    assert.match(dialogContent, /props\.fullscreen\s*\?\s*FULLSCREEN_CONTENT_CLASS/)
    const fullscreenClass = dialogContent.match(
      /const FULLSCREEN_CONTENT_CLASS = '([^']+)'/,
    )?.[1]
    assert.ok(fullscreenClass, 'fullscreen dialog class must be declared explicitly')
    assert.match(fullscreenClass, /fixed inset-0/)
    assert.match(fullscreenClass, /h-dvh w-screen max-w-none/)
    assert.doesNotMatch(fullscreenClass, /top-1\/2|left-1\/2|-translate-|zoom-in|zoom-out/)
  })

  it('keeps the map color mode local instead of mutating the document theme', async () => {
    const map = await readFile(
      new URL('../src/components/ui/map/Map.vue', import.meta.url),
      'utf8',
    )
    assert.doesNotMatch(map, /useColorMode/)
    assert.match(map, /colorMode\?: 'light' \| 'dark'/)
    assert.match(map, /colorMode: 'light'/)
    assert.match(map, /props\.colorMode === 'dark'/)
  })
})
