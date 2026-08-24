import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'

describe('gallery frontend cross-layer contract', () => {
  it('registers a public route and a dynamically gated navigation source', async () => {
    const [router, nav, store] = await Promise.all([
      readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/constants/nav.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/stores/useLayoutStore/index.ts', import.meta.url), 'utf8'),
    ])
    assert.match(router, /path: '\/gallery'/)
    assert.match(nav, /ROUTE_NAMES\.GALLERY/)
    assert.match(store, /galleryStatus\.value\?\.enabled === true/)
    assert.match(store, /!galleryStatusError\.value/)
    assert.match(store, /initialData: \{ enabled: false \}/)
  })

  it('keeps administrator mutations on the public gallery page', async () => {
    const [page, api, hook] = await Promise.all([
      readFile(new URL('../src/pages/Gallery/index.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/api/gallery/index.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Gallery/useGallery.ts', import.meta.url), 'utf8'),
    ])
    assert.match(page, /v-if="isAdmin"/)
    assert.match(page, /gallery-preview/)
    assert.match(page, /GalleryMap/)
    assert.match(api, /\/gallery\/admin\/albums/)
    assert.match(hook, /Promise\.all\(\[worker\(\), worker\(\)\]\)/)
    assert.match(hook, /GALLERY_MAX_BATCH_SIZE/)
    assert.match(hook, /uploadGalleryPhoto\(item\.albumId, item\.file\)/)
    assert.match(hook, /uploadBusy/)
  })

  it('unwraps nested gallery refs and keeps a single transition-safe root', async () => {
    const page = await readFile(new URL('../src/pages/Gallery/index.vue', import.meta.url), 'utf8')
    assert.match(page, /v-if="gallery\.loading\.value"/)
    assert.match(page, /v-else-if="gallery\.error\.value"/)
    assert.match(page, /v-else-if="!gallery\.enabled\.value"/)
    assert.match(page, /<template>\s*<div class="gallery-root">/)
    assert.match(page, /translate: none !important/)
  })
})
