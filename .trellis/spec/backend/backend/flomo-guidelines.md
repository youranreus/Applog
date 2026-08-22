# Flomo Public Notes Cross-Layer Contract

## 1. Scope and Trigger

Use this contract for every change to the Flomo source adapter, encrypted
configuration, durable synchronization, public notes API, admin settings, or
the `/notes` reader UI. A sanitizer-policy change also triggers a full
resynchronization because stored HTML is trusted only under the policy that
created it.

## 2. Signatures

- Shared public contracts are `IFlomoConfig`, `IFlomoAdminStatus` (status type
  `FlomoSyncStatus`), `IFlomoAdminConfig`, `IFlomoPublicMemo`,
  `IFlomoPublicMemoPage`, and `IFlomoSyncTriggerResult`; the fixed public page
  size is `FLOMO_PUBLIC_PAGE_SIZE`.
- The private source seam is `FlomoSourceAdapter.fetchChanges(token, cursor)`
  and returns decoded internal source memos plus a composite source cursor.
  Pagination inside an adapter (for example a private `fetchPage`) must not
  become the module seam. Private protocol request/response shapes must not
  enter `@applog/common`.
- Admin routes are `GET/PUT /flomo/config`, `GET /flomo/status`, and
  `POST /flomo/sync`. Public reads use `GET /flomo/notes?cursor=<public-id>`.
- The no-field JSON sync POST sends `{}`. Public pages are fixed at 20 items and
  use an opaque public-id cursor.
- `DialogContent` accepts an optional `overlayClass` so a page can restyle its
  overlay without changing the shared default. Flomo passes
  `data-open:animate-none data-closed:animate-none` and then WAAPI-fades the
  overlay itself.

## 3. Contracts

- The browser calls AppLog only. It never receives a Flomo token, signature,
  source slug, structured tags, raw source response, attachment metadata, or
  attachment URL.
- Persist the token only as the version-2/key-1 `flomo.token` envelope with
  record identity `1`. Admin reads return `FLOMO_TOKEN_MASK`; empty or masked
  writes retain the existing envelope.
- Structured source tags are an exact any-match server-side publication gate.
  Do not expand parent tags or serialize that collection in public DTOs.
  `IFlomoPublicMemo` is the public allowlist and must be mapped explicitly from
  normalized rows. Its `displayTags` may contain only ordinary hashtag tokens
  extracted from visible sanitized text, with configured publication tags
  excluded, in source order, capped at 20 entries of 64 characters.
- `FlomoSourceAdapter` owns endpoint details, signatures, headers, retries,
  pagination guards, page budgets, and decoding from `unknown`. Attachment
  collections are dropped at this boundary.
- The backend sanitizer is the only HTML trust boundary. It permits text
  structure and safe absolute HTTP(S) links, then removes configured publication
  tag tokens after parsing as well as before parsing. It rejects embedded media,
  executable/foreign-content markup, private Flomo links, styles, and event
  attributes. Extract display hashtags from sanitized text nodes, deduplicate
  them in source order, remove their inline tokens from HTML/preview text, and
  include the bounded final list in the normalized content hash. Remove
  publication tokens through a separate longest-exact-match rule that supports
  every legal configured tag and never partially consumes parent/child names.
- Logs and normalized errors contain only stage, category, status, attempt,
  elapsed time, and counts. Never log token/signature inputs, raw bodies, memo
  text, tags, or attachment URLs.
- Startup, hourly, config-save, and manual triggers share a process promise and
  the MySQL named advisory lock. Startup may normalize persisted `syncing` only
  after acquiring that lock; contention can mean another instance is active.
- A full sync atomically replaces rows and advances the composite cursor.
  Incremental sync uses a one-day lookback, idempotent slug upserts/deletes, and
  a non-regressing `(updatedAt, slug)` high-water mark. Row mutations, applied
  revision, cursor, count, and success state commit in one transaction.
- A token or tag-list change increments `sourceRevision`. Public reads require
  enabled config and equality with `appliedSourceRevision`; otherwise they
  return an empty page. Public reads also require the persisted
  `normalizerVersion` to equal the current code contract. A mismatch forces a
  full replacement sync and remains fail-closed until that transaction commits.
  Read config/state, cursor boundary, and rows in one database transaction to
  avoid mixed policy snapshots.
- Same-revision upstream failure preserves the last good snapshot. A changed
  revision remains fail-closed until its full sync commits. Failed transactions
  never advance the cursor.
- Public notes are database-only, ordered by
  `(sourceCreatedAt DESC, id DESC)`, and fetched with one-row lookahead. The
  public read path never starts upstream work.
- `/notes` appends and deduplicates pages in a responsive masonry flow. Split
  notes into columns in row-major order (visual 1,2 then 3,4) rather than CSS
  `column-count` (which fills vertically as 1,4 then 2,5). Capture the first
  visible existing card before load-more and compensate its vertical
  displacement after a rebalance. Card previews render sanitized
  `contentHtml` through `FlomoContent` (the sole `v-html` owner), not plain
  `previewText`. Collapsed previews clamp and show a surface-colored fade only
  when they overflow. Expanded reading scrolls inside the card body; date and
  `displayTags` stay on a pinned footer row. The same fade sits on the inner
  pane and hides once that pane is scrolled to the bottom. The reading dialog
  does not add a visible「笔记」title or move the date into a separate header. One accessible Reka Dialog provides overlay,
  focus trap, Escape, and close; the source card Teleports into that dialog
  so the same DOM expands. Teleport `to` is unset until the slot exists, then
  switches to `#flomo-note-card-slot` so Vue re-resolves the target instead of
  caching null. Every close path returns the card to the grid,
  restores scroll, and restores focus. The Flomo dialog disables the shared
  `zoom-in` enter animation so it cannot overwrite geometry. It keeps the
  shared dim/blur overlay and fades that overlay's opacity and
  backdrop-filter with the card morph (not the overlay's default 100ms fade).
  Query the overlay as the sibling of `[data-flomo-note-dialog]`, never as a
  bare `[data-slot=dialog-overlay]`. Open mounts prepare-hidden until the
  card is in the slot, then animates `top`/`left`/`width`/`height` (no
  content-stretching `scale`) with `fill: 'both'`, `commitStyles()`, opacity 1,
  and a delayed close-button fade; keyframes use `transform: none`. Geometry
  is not rebound to the source rect after the morph, so the rest frame cannot
  snap back.
  It is progressive enhancement and must degrade safely for reduced motion or
  unavailable animation APIs.

## 4. Validation and Error Matrix

| Boundary | Validation | Failure behavior |
| --- | --- | --- |
| Config write | Enabled requires a retained/new token and at least one normalized exact tag | Reject with a fixed admin-safe validation error |
| Token storage | Envelope purpose/version/key/record identity must match | Reject decryption; never fall back to plaintext |
| Source response | Decode from `unknown`; enforce page, byte, cursor, and run budgets | Stop the run, preserve revision/cursor rules, expose only a normalized category |
| Upstream auth | Classify 401/403 separately | Mark the attempt failed without leaking credentials |
| Upstream throttling | Parse delta-seconds or HTTP-date `Retry-After` within bounded retry policy | Retry within budget, otherwise fail without cursor advancement |
| Memo publication | At least one exact structured tag match and non-empty sanitized text, safe link, or display-tag content | Omit the memo |
| Display tags | Extract only hashtag tokens from sanitized visible text; exclude configured publication tags; cap at 20 × 64 characters | Remove every inline token and persist only the bounded source-order deduplicated list |
| Public read | Enabled, `sourceRevision === appliedSourceRevision`, and current `normalizerVersion` in one transaction | Return an empty page |
| Public cursor | Valid existing public id under the same transactional snapshot | Reject invalid/stale cursor with a fixed business error |
| Dialog enhancement | Source geometry or Web Animations API may be unavailable or throw | Keep ordinary accessible Dialog open/close behavior |

## 5. Good, Base, and Bad Examples

### Good

```ts
const page: IFlomoPublicMemoPage = {
  items: rows.map(mapPublicMemo), // explicit allowlist includes displayTags only
  nextCursor,
}
```

The mapping is an explicit allowlist, the page comes from persisted rows, and no
private source field crosses the boundary.

### Base

```ts
await flomoSyncService.requestSync('manual')
```

Every trigger delegates to the same single-flight/advisory-lock path.

### Bad

```ts
return sourceResponse.data
```

Raw source responses can leak credentials, tags, attachments, source slugs, and
schema details; they must be decoded and normalized privately first.

## 6. Tests Required

- Exact publication-tag isolation (including emoji/dotted names and
  parent/child overlap), hashtag extraction/deduplication/budgets, inline tag
  removal, publication-tag exclusion, lookalikes, entity-encoded tag removal,
  attachment-only omission, XSS/foreign-content fixtures, and safe-link
  normalization.
- Token masking, envelope purpose/record binding, unchanged-save behavior,
  authorization, and secret-free error/log serialization.
- Full/incremental sync, edits, tombstones, duplicates, same-time pagination,
  rollback, cursor non-advancement, process/advisory-lock contention, stale
  startup recovery, same-revision fallback, and changed-revision fail-closed
  visibility. Cover normalizer-version mismatch full-sync and fail-closed reads.
- First/next/end public pages, invalid/stale cursors, equal timestamps, restart
  persistence, and forbidden-field scans.
- Append/dedupe, navigation order, row-major masonry columns and load-more
  scroll anchoring, HTML card preview via `FlomoContent`, overflow detection,
  pinned date/tag footer with inner-pane scrolling, fade that hides at the
  trailing edge, same-DOM Teleport expand, visually hidden Dialog title,
  renderer ownership, borderless Dialog styling, focus/scroll restoration,
  box morph (`top`/`left`/`width`/`height`, `transform: none`,
  `fill: 'both'`, `commitStyles()`, opacity 1, delayed close-button fade),
  Flomo overlay dim/blur faded with the morph, outside-click retained,
  disabled shared zoom-in, and animation/reduced-motion fallbacks.
- Run common build; backend unit/lint/build; frontend unit/lint/type-check/build;
  and `git diff --check`.

## 7. Wrong vs Correct

| Wrong | Correct |
| --- | --- |
| Browser requests Flomo directly | Browser requests AppLog's persisted public API |
| Return a TypeORM entity or raw source memo | Map rows explicitly to `IFlomoPublicMemo` |
| Treat `#parent/child` as matching `#parent` | Match normalized structured tags exactly |
| Return Flomo's structured tag collection for display | Extract display hashtags from sanitized visible text and exclude publication tags |
| Reuse the display hashtag regex to hide publication tokens | Remove legal publication tags with longest exact matching, independently of display syntax |
| Read config, revision, cursor, and rows on separate connections | Read the complete public snapshot in one transaction |
| Mark any persisted `syncing` row interrupted at startup | Acquire the advisory lock before stale-state recovery |
| Advance the cursor before row mutations commit | Commit rows, cursor, revision, count, and success state atomically |
| Serve rows normalized by an older sanitizer/tag contract | Gate on `normalizerVersion` and replace them through a full sync |
| Trust pre-parse text replacement alone | Remove publication-tag tokens again after HTML parsing |
| Style a teleported Dialog only through scoped descendants | Use global Dialog selectors while keeping component ownership local |
| Animate `transform: none` or `translate: 0 0` on the centered Dialog | Animate independent `translate`/`scale` with `calc(-50% + dx)` preserving `-50% -50%` |
| Keep the shared Dialog `zoom-in` enter animation on `/notes` | Disable it on the Flomo dialog; zoom overwrites centering on the first frames |
| Query `[data-slot=dialog-overlay]` globally | Query `[data-slot=dialog-overlay]:has(+ [data-flomo-note-dialog])` |
| Snap the overlay in, or cancel dim/blur entirely | Keep `bg-black/10` + `backdrop-blur-xs` and WAAPI-fade opacity/blur with the morph |
| Assume `element.animate()` cannot fail | Catch enhancement failures and retain normal Dialog behavior |
