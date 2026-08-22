import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { appendUniqueFlomoNotes, formatFlomoNoteDate, shouldMorphFlomoDialog } =
  await jiti.import('../src/pages/Notes/notes-utils.ts')

const note = (id, createdAt = '2026-08-20T02:00:00.000Z') => ({
  id,
  previewText: `note-${id}`,
  contentHtml: `<p>note-${id}</p>`,
  displayTags: ['随想'],
  createdAt,
  updatedAt: createdAt,
})

describe('Flomo notes frontend contract', () => {
  it('appends a fixed page without replacing existing notes or duplicating ids', () => {
    assert.deepEqual(
      appendUniqueFlomoNotes([note('a'), note('b')], [note('b'), note('c'), note('c')]).map(
        (item) => item.id,
      ),
      ['a', 'b', 'c'],
    )
    assert.equal(formatFlomoNoteDate('invalid'), '')
    assert.match(formatFlomoNoteDate('2026-08-20T02:00:00.000Z'), /2026年8月20日/)
  })

  it('disables geometry morphing for reduced motion or unavailable animation APIs', () => {
    const originalWindow = globalThis.window
    const originalHTMLElement = globalThis.HTMLElement
    try {
      globalThis.HTMLElement = class {}
      globalThis.HTMLElement.prototype.animate = () => undefined
      globalThis.window = { matchMedia: () => ({ matches: true }) }
      assert.equal(shouldMorphFlomoDialog(), false)
      globalThis.window = { matchMedia: () => ({ matches: false }) }
      assert.equal(shouldMorphFlomoDialog(), true)
      delete globalThis.HTMLElement.prototype.animate
      assert.equal(shouldMorphFlomoDialog(), false)
    } finally {
      if (originalWindow === undefined) delete globalThis.window
      else globalThis.window = originalWindow
      if (originalHTMLElement === undefined) delete globalThis.HTMLElement
      else globalThis.HTMLElement = originalHTMLElement
    }
  })

  it('keeps the public route/nav order and bodyless JSON sync contract', async () => {
    const [router, nav, api] = await Promise.all([
      readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/constants/nav.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/api/flomo/index.ts', import.meta.url), 'utf8'),
    ])
    assert.ok(router.indexOf("path: '/notes'") < router.indexOf("path: '/:slug.html'"))
    assert.ok(nav.indexOf("title: '文章'") < nav.indexOf("title: '笔记'"))
    assert.match(api, /Post<IFlomoSyncTriggerResult>\('\/flomo\/sync', \{\}\)/)
  })

  it('uses masonry, derived tag presentation and a borderless accessible dialog', async () => {
    const [page, card, dialogSource, motion, content, displayTags] = await Promise.all([
      readFile(new URL('../src/pages/Notes/index.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/components/FlomoNoteCard.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/components/FlomoNoteDialog.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/notes-dialog-motion.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/components/FlomoContent.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/components/FlomoDisplayTags.vue', import.meta.url), 'utf8'),
    ])
    const dialog = `${dialogSource}\n${motion}`
    assert.match(page, /canonicalPath: '\/notes'/)
    assert.match(page, /column-count:\s*2/)
    assert.match(page, /column-count:\s*1/)
    assert.match(page, /loadMoreWithAnchor/)
    assert.match(page, /anchor\.getBoundingClientRect\(\)\.top - anchorTop/)
    assert.match(page, /window\.scrollBy\(0, offset\)/)
    assert.match(card, /scrollHeight > element\.clientHeight/)
    assert.match(card, /v-if="overflowing"/)
    assert.match(card, /break-inside:\s*avoid/)
    assert.match(card, /FlomoContent/)
    assert.match(card, /:content-html="note.contentHtml"/)
    assert.match(card, /props\.note\.contentHtml/)
    assert.doesNotMatch(card, /white-space:\s*pre-wrap/)
    assert.match(card, /FlomoDisplayTags/)
    assert.match(card, /display:\s*flex/)
    assert.match(card, /flex-shrink:\s*0/)
    assert.match(card, /role="button"/)
    assert.match(card, /@keydown\.enter/)
    assert.match(page, /sourceHidden && selected\?\.id === note\.id/)
    assert.match(page, /@source-hidden="setSourceHidden"/)
    assert.match(dialog, /DialogTitle/)
    assert.match(dialog, /DialogDescription/)
    assert.match(dialog, /prefers-reduced-motion/)
    assert.match(dialog, /data-open:animate-none/)
    assert.match(dialog, /data-closed:animate-none/)
    assert.match(dialog, /requestAnimationFrame/)
    assert.match(dialog, /calc\(-50% \+ \$\{dx\}px\) calc\(-50% \+ \$\{dy\}px\)/)
    assert.match(dialog, /CENTERED_TRANSLATE = '-50% -50%'/)
    assert.match(dialog, /scale: `\$\{sourceRect\.width \/ target\.width\}/)
    assert.doesNotMatch(dialog, /translate: '0 0'/)
    assert.doesNotMatch(dialog, /transform: 'none'/)
    assert.match(dialog, /savedScrollY\.value = window\.scrollY/)
    assert.match(dialog, /focus\(\{ preventScroll: true \}\)/)
    assert.match(dialog, /:global\(\.flomo-dialog\)/)
    assert.match(dialog, /FlomoDisplayTags/)
    assert.match(dialog, /border:\s*0\s*!important/)
    assert.match(dialog, /box-shadow:\s*none\s*!important/)
    assert.doesNotMatch(dialog, /border-bottom/)
    assert.match(dialog, /overlay-class/)
    assert.match(dialog, /data-open:animate-none data-closed:animate-none/)
    assert.match(dialog, /flomo-dialog--prepare/)
    assert.match(dialog, /fill: 'backwards'/)
    assert.match(dialog, /OPEN_MORPH_MS = 440/)
    assert.match(dialog, /CLOSE_MORPH_MS = 360/)
    assert.match(dialog, /cubic-bezier\(0\.16, 1, 0\.3, 1\)/)
    assert.match(dialog, /CHROME_FADE_DELAY_MS/)
    assert.match(dialog, /fadeChrome/)
    assert.match(dialog, /fadeOverlay/)
    assert.match(dialog, /blur\(0px\)/)
    assert.match(dialog, /blur\(4px\)/)
    assert.doesNotMatch(dialog, /opacity:\s*0\.7/)
    assert.doesNotMatch(dialog, /!bg-transparent/)
    assert.match(dialog, /'source-hidden': \[hidden: boolean\]/)
    assert.match(content, /v-html="contentHtml"/)
    assert.match(displayTags, /#\{\{ tag \}\}/)
    for (const source of [page, card, dialog]) assert.doesNotMatch(source, /v-html|attachment|publicationTags/)
  })

  it('keeps the shared dim overlay and fades Flomo blur with the morph', async () => {
    const [content, overlay, dialog, motion] = await Promise.all([
      readFile(new URL('../src/components/ui/dialog/DialogContent.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/components/ui/dialog/DialogOverlay.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/components/FlomoNoteDialog.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/Notes/notes-dialog-motion.ts', import.meta.url), 'utf8'),
    ])
    assert.match(overlay, /bg-black\/10/)
    assert.match(overlay, /supports-backdrop-filter:backdrop-blur-xs/)
    assert.match(content, /overlayClass/)
    assert.match(content, /reactiveOmit\(props, 'class', 'overlayClass', 'showCloseButton'\)/)
    assert.match(content, /DialogOverlay :class="cn\(props\.overlayClass\)"/)
    assert.match(dialog, /FLOMO_OVERLAY_CLASS/)
    assert.match(dialog, /data-open:animate-none data-closed:animate-none/)
    assert.match(dialog, /fadeOverlay\('in', OPEN_MORPH_MS/)
    assert.match(dialog, /fadeOverlay\('out', CLOSE_MORPH_MS/)
    assert.match(motion, /\[data-slot="dialog-overlay"\]:has\(\+ \[data-flomo-note-dialog\]\)/)
    assert.doesNotMatch(dialog, /!bg-transparent/)
    assert.doesNotMatch(dialog, /!backdrop-blur-none/)
  })

  it('keeps admin settings on the shared notify/mask contract', async () => {
    const [settings, systemSettings] = await Promise.all([
      readFile(
        new URL('../src/pages/user/Dashboard/components/FlomoSettings.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/user/Dashboard/components/SystemSettings.vue', import.meta.url),
        'utf8',
      ),
    ])
    assert.match(settings, /FLOMO_TOKEN_MASK/)
    assert.match(settings, /layoutStore\.notify/)
    assert.match(settings, /type="password"/)
    assert.doesNotMatch(settings, /alovaInstance/)
    assert.match(systemSettings, /<FlomoSettings v-if="isAdmin" \/>/)
  })
})
