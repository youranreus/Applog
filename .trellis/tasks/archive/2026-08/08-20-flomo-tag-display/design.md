# Flomo notes integration design

## Architecture and boundaries

```text
Admin FlomoSettings
  -> PUT /flomo/config
  -> encrypted FlomoConfigEntity + config revision
  -> POST /flomo/sync or hourly/startup trigger

Flomo Web private API
  -> FlomoSourceAdapter (token, signature, HTTP, pagination, unknown decoding)
  -> exact publication-tag gate
  -> attachment removal + HTML sanitizer + public normalizer
  -> MySQL advisory lock + atomic snapshot/cursor transaction
  -> FlomoPublicMemoEntity + FlomoSyncStateEntity

GET /flomo/notes?cursor=<public-id>
  -> shared public allowlist DTO
  -> Alova page hook
  -> /notes card grid
  -> source-card morph -> full-content Dialog
```

The task remains one vertical slice because the encrypted configuration,
source adapter, durable snapshot, public cursor API, navigation, and card/Dialog
surface do not produce independently useful releases.

## Shared contracts

Add framework-free Flomo contracts and constants to `@applog/common`:

```text
IFlomoConfig
  token: string
  publicationTags: string[]
  enabled: boolean

IFlomoAdminStatus
  status: never_synced | syncing | healthy | degraded | reauth_required
  lastAttemptedAt: string | null
  lastSuccessfulAt: string | null
  publicMemoCount: number
  errorCategory: string | null

IFlomoAdminConfig extends IFlomoConfig
  sync: IFlomoAdminStatus

IFlomoPublicMemo
  id: string
  previewText: string
  contentHtml: string
  displayTags: string[]
  createdAt: string
  updatedAt: string

IFlomoPublicMemoPage
  items: IFlomoPublicMemo[]
  nextCursor: string | null
```

`FLOMO_TOKEN_MASK` follows the existing `********` convention. Publication-tag helpers trim
whitespace, remove one optional leading `#`, deduplicate exact canonical names,
reject empty/oversized lists and values, and never expand a parent tag. Public
memo types cannot express source slug, structured source tags, attachments, raw
payloads, source cursor, credentials, or synchronization diagnostics. The only
public tag field is the derived `displayTags` allowlist, capped at 20 entries of
at most 64 Unicode characters each.

## Persistence model

### `FlomoConfigEntity` (`flomo_config`)

A singleton row (`id=1`) owns `enabled`, JSON `publicationTags`, a monotonically
increasing `sourceRevision`, and a nullable all-or-none token envelope:
`ciphertext`, 12-byte `nonce`, 16-byte `authTag`, `envelopeVersion`, and
`keyVersion`. The token uses purpose `flomo.token` and record identity `1`.
Saving an actually changed token or tag list increments `sourceRevision`;
toggling enabled alone does not change the source identity.

### `FlomoPublicMemoEntity` (`flomo_public_memo`)

Each row has an internal numeric id, unique random `publicId`, unique server-only
`sourceSlug`, sanitized `contentHtml`, plain `previewText`, nullable JSON
`displayTags`,
source creation and update timestamps, and a SHA-256 `contentHash`. Only
`publicId`, content, derived display tags, and timestamps are projected to public
DTOs. Source slug is required for idempotent upsert/delete but never serialized
or logged with content.

### `FlomoSyncStateEntity` (`flomo_sync_state`)

The singleton state stores `appliedSourceRevision`, persisted
`normalizerVersion`, the exact upstream composite cursor (`latestUpdatedAt`,
`latestSlug`), last attempt/success timestamps, normalized status/error category,
and public memo count. Cursor values and the applied normalizer version update in
the same transaction as the rows they describe. A normalizer-version mismatch
forces a full replacement sync and keeps public reads fail-closed until commit.

The project uses TypeORM `synchronize: true`; all three entities are registered
in `ENTITY_LIST` and the Flomo module's `forFeature` list. Staging schema sync is
required before production activation.

## Configuration and credential boundary

Dedicated admin `GET/PUT /flomo/config` routes are the only credential-management
surface. Reads return the mask, never envelope fields. Empty or masked writes
retain the current token; a non-empty token is normalized by removing an
optional `Bearer ` prefix, encrypted with a fresh nonce, and never held after
the save/sync operation. Generic system-config routes are not used for Flomo.

If token or publication tags change, the saved `sourceRevision` immediately
differs from `appliedSourceRevision`. Public reads then return an empty page even
though the old rows remain transactionally recoverable. This privacy gate keeps
old-account or old-tag content from leaking while the new full sync is pending
or failing. A same-revision upstream failure continues serving the prior rows.

## Source adapter

`FlomoSourceAdapter` is the only interface known by synchronization logic. The
MVP `FlomoWebSourceAdapter` owns the private endpoint, MD5 signature, browser
protocol parameters, authorization header, timeout/retry classification, and
response decoding from `unknown`. A future official-MCP adapter can implement
the same page contract without changing persistence, public APIs, or UI.

The Web adapter uses `GET /api/v1/memo/updated/`, page size 200, and faithfully
passes both `latest_updated_at` and `latest_slug`. It rejects repeated cursors,
non-progressing full pages, excessive page counts, and invalid required fields.
Network timeout, 429/`Retry-After`, and bounded 5xx retries use a small capped
budget; 401/403 and schema/signature failures do not retry blindly. Logs contain
only stage, attempt, elapsed time, status/error category, and counts—never token,
signature input, raw body, memo text, tag names, or attachment URLs.

## Normalization and content safety

Raw pages live only in sync memory. For every memo:

1. Validate stable slug and timestamps from `unknown`.
2. If deleted, emit an internal delete action by source slug.
3. Exact-match its structured tags against the canonical allowlist. A miss emits
   a delete action so tag removal withdraws any existing public row.
4. Drop the attachment collection before any persistence mapping.
5. Sanitize Flomo HTML with a mature server-side parser/sanitizer. Allow only
   paragraph/line-break, emphasis, quote, list, code, and safe absolute HTTP(S)
   link semantics; remove scripts, event/style/class/id attributes, embedded
   media, forms, iframes, data/javascript URLs, private Flomo links, and known
   publication-tag tokens. External links gain `noopener noreferrer nofollow`.
6. From sanitized text nodes, extract ordinary inline hashtag tokens with a
   Unicode-aware boundary rule, deduplicate them in source order, remove their
   visible tokens from the HTML/text body, and exclude configured publication
   tags. Persist only these derived `displayTags`; never reuse Flomo's structured
   source-tag collection as presentation data. Keep at most 20 display tags of
   at most 64 characters; over-budget tokens are still removed from the body.
   Publication-token removal is a separate longest-exact-match pass so legal
   configuration tags such as emoji or dotted names cannot leak and a parent
   token cannot partially consume a child token.
7. Derive plain `previewText` from the tag-free sanitized tree. If no meaningful
   text, safe link, or display tag remains, emit delete/no-row rather than an
   empty card; a note containing only ordinary display tags remains publishable.
8. Hash the normalized public representation, including `displayTags`, for
   idempotent updates.

The frontend does not reuse the existing permissive Markdown renderer. A
dedicated Flomo content component is the sole `v-html` owner and accepts only the
typed backend-sanitized field. XSS fixtures prove the stored and serialized HTML
allowlist rather than relying on client cleanup.

## Synchronization coordinator

`FlomoSyncService` runs on module startup, on one unref'ed one-hour interval, on
source-affecting config save, and after admin `POST /flomo/sync` (sent with `{}`
as the JSON body). Triggers share a process promise and also acquire a zero-wait
MySQL named advisory lock so multiple application instances cannot overlap.

- **Full mode:** used when no successful state exists, source revisions differ,
  or the persisted normalizer version differs from the code contract.
  Start from an empty source cursor, collect the complete normalized public set,
  then in one transaction replace public rows and store the final cursor,
  applied revision, count, and healthy status.
- **Incremental mode:** start the upstream request at one day before the
  persisted update time with an empty initial slug, while retaining the saved
  composite cursor as the non-regressing high-water mark. Normalize every page,
  then in one transaction apply idempotent upserts/deletes plus the greatest
  observed composite cursor and status. Same-timestamp ordering uses source slug
  as the tie-breaker.
- **Failure:** any page/decode/normalization/transaction failure aborts the run
  without advancing the cursor or partially publishing rows. Same-revision rows
  remain public and status becomes degraded/reauth-required; revision-mismatched
  old rows remain hidden. A later trigger retries from the prior checkpoint.

The admin manual endpoint schedules the background run and returns whether it
was accepted/already running; it does not hold an HTTP request open for the
complete import. `GET /flomo/status` supports short polling while the settings
screen is visible. A stale persisted `syncing` state is normalized to degraded
on startup before a new attempt.

## Public API

`GET /flomo/notes?cursor=<publicId>` is public and reads MySQL only. It returns a
fixed maximum of 20 rows ordered by `(sourceCreatedAt DESC, id DESC)`. An optional
cursor must identify an existing public row and applies the stable tuple
boundary; the last item becomes `nextCursor` only when another row exists. There
is no total count, structured source-tag field, source id, upstream request, or
per-memo endpoint. Each memo may include only the derived, deduplicated
`displayTags` extracted from its already-public text.

Disabled, never-synchronized, revision-mismatched, or normalizer-version-
mismatched configurations return an empty page. Database/query failures follow
normal API error handling; upstream failures cannot occur in this request path.

## Frontend experience

Add `ROUTE_NAMES.NOTES` and `/notes` before the catch-all page route. Insert the
`笔记` route item directly after `文章` in `NAV_GROUPS.default`; the admin user nav
is unchanged. `Notes/index.vue` uses the shared `common-page-container` width,
an editorial page heading, and a one-column mobile/multi-column wider masonry
card flow within the existing Apple-light design system.

The page hook owns the initial request, append/deduplication, cursor, retry, and
end state. Because CSS columns rebalance on append, loading captures the first
visible existing card and compensates its post-append vertical displacement to
preserve reading context. Cards render sanitized `contentHtml` through
`FlomoContent` (the sole `v-html` owner), height-clamp that preview, and measure
real overflow with a `ResizeObserver` watching `contentHtml`. A surface-colored
bottom fade appears only when `scrollHeight > clientHeight`. Date and derived
display tags share one footer row; cards remain keyboard-activatable and expose
an explicit accessible name. `previewText` stays on the public DTO but is not
the visual preview.

A single page-level Reka Dialog receives the selected memo and source card
rectangle. The Flomo dialog disables the shared Dialog `zoom-in`/`zoom-out`
enter/exit animation because those `transform: scale(...)` keyframes overwrite
centering. It keeps the shared `DialogOverlay` dim/blur (`bg-black/10` +
`backdrop-blur-xs`) and disables that overlay's default 100ms fade so Flomo can
drive a matching WAAPI transition: opacity and `blur(0px)` → `blur(4px)` over
the same 440ms open / 360ms close as the card morph. The overlay stays hidden
during `flomo-dialog--prepare` so it does not pop in before FLIP starts.
Outside-click and Escape still close the dialog. Other dialogs keep the default
overlay animation. Opening mounts the dialog visually hidden (`flomo-dialog--prepare`),
waits for layout, then starts a centering-preserving FLIP with
`fill: 'backwards'` so the source-card from-state applies immediately at
opacity 1. The source card stays visible until that covering from-state is on;
chrome (title and close) fades in after a short delay and fades out at the
start of the reverse close morph. Open uses ~440ms
`cubic-bezier(0.16, 1, 0.3, 1)`; close is slightly faster with a standard
ease-in-out. Measurement waits until the dialog box is laid out. Keyframes
preserve the base Dialog centering transform
(`translate: calc(-50% + dx) calc(-50% + dy)` to `translate: -50% -50%`; never
`0 0` or `transform: none`). The source card remains layout-preserving and is
visually hidden only while the dialog covers it. The dialog is centered,
scrolls internally within the viewport after the morph, renders the sanitized
full content with display tags at the bottom, and retains Reka focus
trap/Escape/outside behavior. Its reading surface has no outer border, shadow,
or internal divider. Unsupported or reduced-motion environments skip geometric
morphing, still fade the overlay, show content immediately, and remain
accessible. Closing restores the trigger focus and does not alter page scroll.

## Compatibility, rollout, and rollback

- Missing config is disabled and exposes no notes. The first successful full
  sync is the activation boundary.
- New/unknown upstream fields are ignored; malformed required fields fail the
  run closed and preserve the applicable last snapshot.
- The private adapter is explicitly unstable and credential-equivalent to a Web
  session. Admin copy must state that risk without displaying protocol secrets.
- Rollback disables the config and removes the public nav/route/module wiring;
  database rows and encrypted credentials are retained for recovery and are not
  destructively deleted as part of application rollback.
- Staging must verify TypeORM schema creation, initial full sync, restart reads,
  advisory-lock behavior, and a disabled/config-revision rollback before
  production enablement.

## Trade-offs

- Persisting sanitized HTML enables an instant full-content dialog and keeps
  visitor traffic independent of Flomo, at the cost of re-sanitizing every memo
  whenever the sanitizer policy changes.
- Fixed 20-item cursor batches fit `加载更多` and avoid count queries, but do not
  offer page-number deep links.
- Hiding old rows after token/tag changes favors privacy over last-known-good
  availability; last-known-good remains available only for failures under the
  already-applied source policy.
- A private Web adapter provides unattended hourly sync now but carries material
  compatibility and account-risk debt; the adapter boundary is mandatory, not
  optional abstraction.
