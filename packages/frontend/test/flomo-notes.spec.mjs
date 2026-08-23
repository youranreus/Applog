import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const {
  appendUniqueFlomoNotes,
  formatFlomoNoteDate,
  isOverflowing,
  isScrolledToBottom,
  shouldMorphFlomoDialog,
  splitNotesIntoColumns,
} = await jiti.import('../src/pages/Notes/notes-utils.ts')

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

  it('detects overflow and trailing-edge scroll for the card fade', () => {
    assert.equal(isOverflowing({ scrollHeight: 200, clientHeight: 100 }), true)
    assert.equal(isOverflowing({ scrollHeight: 100, clientHeight: 100 }), false)
    assert.equal(isScrolledToBottom({ scrollTop: 0, clientHeight: 100, scrollHeight: 200 }), false)
    assert.equal(isScrolledToBottom({ scrollTop: 100, clientHeight: 100, scrollHeight: 200 }), true)
  })

  it('splits notes into row-major masonry columns', () => {
    assert.deepEqual(splitNotesIntoColumns(['1', '2', '3', '4', '5', '6'], 2), [
      ['1', '3', '5'],
      ['2', '4', '6'],
    ])
    assert.deepEqual(splitNotesIntoColumns(['1', '2', '3'], 1), [['1', '2', '3']])
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
    assert.match(page, /splitNotesIntoColumns/)
    assert.match(page, /NOTES_WIDE_MEDIA_QUERY/)
    assert.doesNotMatch(page, /column-count/)
    assert.match(page, /note-card-placeholder/)
    assert.match(page, /loadMoreWithAnchor/)
    assert.match(page, /anchor\.getBoundingClientRect\(\)\.top - anchorTop/)
    assert.match(page, /window\.scrollBy\(0, offset\)/)
    assert.match(page, /focus\(\{ preventScroll: true \}\)/)
    assert.match(card, /showFade/)
    assert.match(card, /note-card__scroll/)
    assert.match(card, /isOverflowing/)
    assert.match(card, /isScrolledToBottom/)
    assert.match(card, /overscroll-behavior:\s*contain/)
    assert.match(card, /scrollbar-width:\s*none/)
    assert.match(card, /:disabled="!expanded"/)
    assert.match(card, /expanded \? `#\$\{FLOMO_CARD_SLOT_ID\}` : undefined/)
    assert.doesNotMatch(card, /Teleport defer/)
    assert.match(card, /FLOMO_CARD_SLOT_ID/)
    assert.match(page, /await nextTick\(\)\s*\n\s*expandedId\.value = note\.id/)
    assert.match(card, /FlomoContent/)
    assert.match(card, /:content-html="note.contentHtml"/)
    assert.match(card, /props\.note\.contentHtml/)
    assert.doesNotMatch(card, /white-space:\s*pre-wrap/)
    assert.match(card, /FlomoDisplayTags/)
    assert.match(card, /display:\s*flex/)
    assert.match(card, /flex-shrink:\s*0/)
    assert.match(card, /:role="expanded \? undefined : 'button'"/)
    assert.match(card, /@keydown\.enter/)
    assert.match(page, /expandedId === note\.id/)
    assert.match(page, /@source-released="releaseSource"/)
    assert.match(dialog, /DialogTitle/)
    assert.match(dialog, /sr-only/)
    assert.doesNotMatch(dialog, /DialogDescription/)
    assert.doesNotMatch(dialog, /flomo-dialog__header/)
    assert.match(dialog, /prefers-reduced-motion/)
    assert.match(dialog, /data-open:animate-none/)
    assert.match(dialog, /data-closed:animate-none/)
    assert.match(dialog, /requestAnimationFrame/)
    assert.match(dialog, /measureRestBox/)
    assert.match(dialog, /playBoxMorph/)
    assert.match(dialog, /waitForFrames/)
    assert.match(dialog, /clearBoxAnimations/)
    assert.match(dialog, /isolateDialogLayer/)
    assert.match(dialog, /transitionend/)
    assert.doesNotMatch(dialog, /boxKeyframe/)
    assert.match(dialog, /translateZ\(0\)/)
    assert.doesNotMatch(motion, /webkitBackdropFilter/)
    assert.doesNotMatch(motion, /backdropFilter:\s*'/)
    assert.doesNotMatch(dialog, /scale: `\$\{sourceRect\.width \/ target\.width\}/)
    assert.match(dialog, /savedScrollY\.value = window\.scrollY/)
    assert.match(dialog, /:global\(\.flomo-dialog\)/)
    assert.match(dialog, /FLOMO_CARD_SLOT_ID/)
    assert.match(dialog, /border:\s*0\s*!important/)
    assert.match(dialog, /box-shadow:\s*none\s*!important/)
    assert.doesNotMatch(dialog, /border-bottom/)
    assert.match(dialog, /overlay-class/)
    assert.match(dialog, /data-open:animate-none data-closed:animate-none/)
    assert.match(dialog, /flomo-dialog--prepare/)
    assert.match(dialog, /pointer-events:\s*none/)
    assert.doesNotMatch(dialog, /fill: 'backwards'/)
    assert.match(dialog, /OPEN_MORPH_MS = 440/)
    assert.match(dialog, /CLOSE_MORPH_MS = 360/)
    assert.match(dialog, /cubic-bezier\(0\.16, 1, 0\.3, 1\)/)
    assert.match(dialog, /CHROME_FADE_DELAY_MS/)
    assert.match(dialog, /fadeChrome/)
    assert.match(dialog, /fadeOverlay/)
    assert.match(dialog, /z-\[51\]/)
    assert.doesNotMatch(dialog, /opacity:\s*0\.7/)
    assert.doesNotMatch(dialog, /!bg-transparent/)
    assert.match(dialog, /'source-released': \[\]/)
    assert.match(content, /v-html="contentHtml"/)
    assert.match(displayTags, /#\{\{ tag \}\}/)
    for (const source of [page, card, dialog]) assert.doesNotMatch(source, /v-html|attachment|publicationTags/)
  })

  it('keeps the shared dim overlay and fades overlay opacity with the morph', async () => {
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
    assert.match(content, /data-slot="dialog-root"/)
    assert.match(content, /absolute inset-0 pointer-events-auto/)
    assert.match(content, /DialogOverlay :class="cn\('absolute inset-0 pointer-events-auto', props\.overlayClass\)"/)
    assert.match(dialog, /FLOMO_OVERLAY_CLASS/)
    assert.match(dialog, /data-open:animate-none data-closed:animate-none/)
    assert.match(dialog, /fadeOverlay\('in', OPEN_MORPH_MS/)
    assert.match(dialog, /fadeOverlay\('out', CLOSE_MORPH_MS/)
    assert.match(dialog, /pointer-events:\s*none/)
    assert.match(motion, /\[data-slot="dialog-overlay"\]:has\(\+ \[data-flomo-note-dialog\]\)/)
    assert.match(motion, /\[\{ opacity: from \}, \{ opacity: to \}\]/)
    assert.doesNotMatch(motion, /webkitBackdropFilter/)
    assert.doesNotMatch(motion, /backdropFilter:\s*'/)
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
