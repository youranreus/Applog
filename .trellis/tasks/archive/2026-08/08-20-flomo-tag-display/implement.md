# Flomo notes integration implementation plan

## 1. Shared contracts and persistent schema

- [x] Add Flomo config, admin status, public memo/page DTOs (including derived
  display tags), mask, fixed page size, and pure tag/token normalization helpers
  to `@applog/common`; export
  them from the root barrel and test/build their null, duplicate, leading-`#`,
  exact-match, mask-retention, and limit behavior through consumers.
- [x] Add `FlomoConfigEntity`, `FlomoPublicMemoEntity`, and
  `FlomoSyncStateEntity` with the indexes, envelope metadata, revision gate,
  composite cursor, content hash, and timestamps defined in `design.md`.
- [x] Register entities in `ENTITY_LIST` and the Flomo module.
- [ ] Validate schema creation against a disposable/staging MySQL database
  before production (deferred: this workspace has no real MySQL environment).

## 2. Encrypted admin configuration

- [x] Implement all-or-none `flomo.token` envelope persistence using
  `SecretEncryptionService` and stable record identity `1`; normalize optional
  `Bearer ` input and zero plaintext buffers where practical after use.
- [x] Add validated admin config DTOs and dedicated `GET/PUT /flomo/config`.
  Mask reads, retain an existing token on empty/masked writes, reject invalid
  enabled configs, and increment source revision only when token/tags change.
- [x] Add public-read revision gating and focused tests for auth, masking,
  cross-record/purpose rejection, unchanged-save behavior, and immediate hiding
  after source-policy changes.

## 3. Replaceable source adapter and sanitizer

- [x] Define the internal source page/memo/error contract and adapter injection
  token; keep raw response types and protocol constants out of common/public DTOs.
- [x] Implement the Web adapter's signed request, full composite pagination,
  timeout, bounded retry/`Retry-After`, repeated-cursor/page guards, and strict
  decode-from-`unknown` boundary.
- [x] Add a mature backend HTML sanitizer dependency and pure normalization for
  exact any-tag publication, publish-tag removal, media/attachment stripping,
  safe HTTP(S) links, inline hashtag extraction/removal, publication-tag
  exclusion, preview text, empty-content rejection, timestamps, and content
  hashes.
- [x] Test signature fixtures, same-timestamp pagination, 401/403/429/5xx/
  timeout/schema classification, secret-free logs, XSS vectors, dangerous URLs,
  tag lookalikes, display-tag extraction/deduplication, publication-tag hiding,
  attachment-only memos, and deterministic normalization.

## 4. Transactional synchronization

- [x] Implement startup/hourly/manual/config triggers with an unref'ed timer,
  process single-flight, MySQL advisory lock, maximum run/page budgets, and
  lifecycle cleanup.
- [x] Implement full revision sync as an atomic snapshot replacement and
  incremental sync as atomic idempotent upserts/deletes plus cursor advancement,
  including one-day lookback and stable same-timestamp slug ordering.
- [x] Persist normalized health/count/attempt/success state; normalize stale
  `syncing` on startup; make the manual endpoint return accepted/already-running
  and expose admin polling through `GET /flomo/status`.
- [x] Test full/incremental/restart behavior, duplicate pages, edits, tag removal,
  tombstones, transaction rollback, cursor non-advancement, multi-trigger races,
  advisory-lock contention, same-revision stale fallback, and changed-revision
  fail-closed visibility.

## 5. Public cursor API

- [x] Add public `GET /flomo/notes` with an optional validated public-id cursor,
  fixed 20-item `(createdAt,id)` keyset ordering, one-row lookahead, and shared
  allowlist DTO mapping.
- [x] Return empty pages for disabled/never-applied/revision-mismatched states;
  never initiate upstream work from the controller/service read path.
- [x] Test first/next/end pages, invalid/stale cursors, equal timestamps,
  restart-persisted rows, and forbidden-field serialization scans.

## 6. Admin Flomo settings

- [x] Add typed Alova config/status/manual-sync methods; bodyless JSON sync POST
  sends `{}` and all routes remain admin-authenticated through the backend.
- [x] Add `FlomoSettings.vue` to System Settings with enable switch, masked token
  retention, newline-separated exact tag input, validation copy, last attempt/
  success, count, normalized health, save/reload feedback, and `立即同步` polling.
- [x] Use existing Field/Button/Switch/Input/Textarea and notification patterns;
  do not surface raw upstream messages, structured source-tag data, or
  credentials.

## 7. Public notes route and card/Dialog experience

- [x] Add `ROUTE_NAMES.NOTES`, `/notes`, canonical SEO, and insert `笔记` after
  `文章` in the default public navigation without changing the admin nav.
- [x] Add the page API/hook with initial loading, 20-item append, dedupe, retry,
  and end states; build the responsive single-column/multi-column masonry flow
  in the shared public container.
- [x] Build accessible card previews that render sanitized `contentHtml` through
  `FlomoContent`, with real overflow measurement and a conditional
  surface-colored bottom fade. Date and display tags share one footer row.
- [x] Build the single full-content Reka Dialog and dedicated trusted Flomo HTML
  renderer. Implement source-rectangle FLIP open/close, source visibility,
  internal scrolling, all close paths, focus/scroll restoration, and standard
  fallbacks for reduced motion or unsupported animation APIs. Remove the outer
  border, shadow, and all internal divider lines.
- [x] Render derived display-tag chips at the bottom of cards and dialogs without
  exposing configured publication tags or adding public filtering.
- [x] Add pure/frontend regression tests for date formatting, append/dedupe,
  nav/route order, fixed batch behavior, masonry layout, tag placement,
  borderless dialog styling, safe renderer ownership, dialog semantics, and
  reduced-motion rules.
- [ ] Visually inspect wide, tablet, and 390px states including long/short/empty/
  error content with representative synchronized data (deferred: no live Flomo
  token; desktop and 390px error states were inspected).

## 8. Cross-layer verification and knowledge capture

- [x] Run common build, complete backend unit tests/lint/build, frontend unit
  tests/lint/type-check/build, and `git diff --check`.
- [ ] Verify in a real browser with synchronized notes that cards only fade on
  overflow, load-more keeps
  scroll/context, dialog morph/fallback/keyboard behavior works, and no browser
  request targets Flomo.
- [ ] Verify database-at-rest token encryption, public response/log redaction,
  config-revision privacy gating, process restart, same-policy upstream failure,
  tag withdrawal, deletion, and advisory-lock contention with representative
  data.
- [x] Capture the finalized Flomo cross-layer contract in `.trellis/spec/` and
  link it from backend/frontend/common indexes before the final commit.

## Validation commands

```bash
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
git diff --check
```

## Risk and rollback points

- The highest-risk boundary is the private API. Keep all protocol code in the
  adapter and stop the run without cursor advancement on signature/schema drift.
- The highest privacy risk is serving rows created under a previous token/tag
  policy. The source-revision gate must be tested before any UI work is accepted.
- Sanitized HTML is trusted only after the backend allowlist. Any sanitizer
  policy change requires fixture tests and a full re-synchronization.
- TypeORM uses `synchronize: true`; validate the three new tables in staging and
  do not rely on production startup as the first schema test.
- Roll back safely by disabling Flomo and removing route/nav/module activation
  while retaining encrypted config and public rows. Do not drop tables or erase
  the last snapshot during application rollback.
