# Add tag-filtered Flomo display

## Goal

Publish selected Flomo memos as a quiet, card-based `笔记` reading surface in
AppLog without exposing Flomo credentials, private tags, unselected memos, raw
account responses, or attachment URLs.

## Confirmed Background

- The application-level HKDF/AES-GCM secret contract is complete and reserves
  the immutable `flomo.token` purpose for this integration.
- The MVP uses the Flomo Web bearer-token interface because an unattended
  official MCP server flow is not yet verified. That interface is private and
  unstable, so it must remain behind a replaceable backend adapter.
- The private update endpoint returns account changes rather than a trusted
  server-side publication filter. AppLog therefore owns exact tag matching,
  sanitization, persistence, and the public allowlist boundary.
- Public browser requests read only AppLog database records and never call
  Flomo directly.

## Requirements

### Public notes experience

- Add a top-level public page named `笔记` and place its global-navigation link
  immediately to the right of `文章`.
- Present notes newest first in a responsive masonry card collection: one
  column on narrow screens and waterfall columns on wider screens. Load 20 cards
  initially and append the next batch only when the reader activates
  `加载更多`; do not use infinite scrolling or numbered pagination.
- Clamp card previews by rendered height. Show a bottom fade only when the
  preview actually overflows; short cards must not display a misleading fade.
- Activating a card enlarges the originating card into a dialog-style reading
  surface containing the complete sanitized memo. Closing restores the source
  card, page scroll position, and keyboard focus; it does not navigate to a
  separate detail route.
- The dialog must support a visible close control, Escape and backdrop closing,
  focus trapping, and a reduced-motion fallback that preserves all content and
  context without the morph animation.
- Render the dialog as a borderless, shadowless reading surface with no internal
  divider lines.
- Extract ordinary inline `#tag` tokens from memo text, remove those tokens from
  the card/dialog body, and show the deduplicated tags at the bottom of both
  surfaces. Configured publication tags remain private control metadata and are
  excluded from the displayed tags.

### Publication and privacy boundary

- Allow several configurable publication tags. A memo is publishable when at
  least one configured tag matches exactly; parent tags do not implicitly
  include descendants.
- Treat structured source tags only as a private backend publication gate.
  Public APIs and UI must not return those source tags or expose tag filtering.
  Public DTOs may carry only display tags extracted from visible memo text after
  configured publication tags have been excluded.
- Store and expose only sanitized memo text, derived display tags, and source
  creation/update times.
  Do not download, proxy, persist, or expose Flomo image, audio, file, or other
  attachment metadata or URLs. Attachment-only memos do not create empty cards.
- Remove a public memo after a successful sync observes remote deletion or that
  it no longer matches the publication allowlist.
- Source-token or publication-tag changes invalidate the previously applied
  publication policy immediately. Old-policy rows must not remain publicly
  readable while a replacement full synchronization is pending or failing.

### Synchronization and persistence

- Encrypt the Flomo bearer token at rest with the existing `flomo.token`
  envelope contract and decrypt it only during trusted backend synchronization.
  Mask it in every admin read and exclude it from logs and errors.
- Synchronize once per hour and expose an admin-only `立即同步` action. Concurrent
  timer, startup, and manual triggers must not create overlapping runs.
- Handle source pagination and incremental updates idempotently with a durable
  composite source cursor. Commit public-row changes and the corresponding
  cursor atomically only after the complete run succeeds.
- Persist normalized public memo rows and synchronization state in MySQL so a
  process restart can serve the latest successfully applied snapshot without an
  upstream request.
- An ordinary failure under the already-applied configuration keeps serving the
  last successful database snapshot. Authentication, rate-limit, timeout,
  upstream-schema, and compatibility failures must be visible to admins through
  credential-free status and diagnostics.

### Administration

- Add an admin settings section with enabled state, masked bearer-token input,
  multiple exact publication tags, save/reload feedback, last attempt/success,
  public memo count, normalized sync health, and `立即同步`.
- Empty or masked token submissions retain the stored token. Enabling without a
  stored token or at least one valid publication tag is rejected.
- Saving a source-affecting change starts a background full synchronization;
  ordinary public requests never wait for it.

## Acceptance Criteria

- [ ] `笔记` appears immediately after `文章` in the public header and opens a
  canonical public notes route.
- [ ] The route loads 20 newest-first cards; `加载更多` appends without replacing
  existing cards and has distinct loading, retry, and end-of-list states.
- [ ] Only genuinely overflowing previews are height-clamped with a bottom fade
  across desktop and narrow viewports.
- [ ] Wider viewports use a masonry/waterfall card layout while narrow
  viewports remain single-column.
- [ ] A card opens from its source position into an accessible full-content
  dialog; all close paths, focus restoration, scroll preservation, and
  reduced-motion behavior work. The dialog has no outer border, shadow, or
  internal divider.
- [ ] Inline `#tag` tokens are removed from body content and rendered once at
  the bottom of cards and dialogs; publication-control tags remain hidden.
- [ ] Multiple exact publication tags use any-match semantics, while
  parent/child lookalikes, configured publication-tag names, structured source
  tags, and unselected memos never cross the public API.
- [ ] Public rows and responses contain no attachment metadata/URLs, credentials,
  raw private responses, or unsafe executable markup; attachment-only memos are
  omitted.
- [ ] The token round-trips only through the versioned `flomo.token` encrypted
  envelope and is masked or redacted in admin responses, errors, and logs.
- [ ] Initial/full and incremental synchronization handle same-timestamp pages,
  duplicates, edits, tag removal, and deletion idempotently, and atomically
  persist rows with the matching cursor/configuration revision.
- [ ] Hourly, startup, and manual triggers are single-flight across application
  instances; a successful snapshot survives restart.
- [ ] Same-policy source failures preserve the previous public snapshot, while
  a changed token/tag policy hides the old-policy snapshot until its full sync
  succeeds.
- [ ] Automated tests cover authorization, secret retention/redaction, exact tag
  isolation, sanitization/XSS, attachment stripping, cursor pagination,
  transactional failure, configuration races, and public response allowlists.

## Out of Scope

- Image, audio, file, or other attachment synchronization and hosting.
- Public tag filtering, search, numbered pagination, or infinite scrolling.
- A per-memo URL, detail page, comments, reactions, or editing Flomo content from
  AppLog.
- OAuth, multi-user Flomo accounts, or replacing the MVP adapter with official
  MCP before its unattended runtime contract is verified.
- Copying Obsidian filesystem, timer, backlink, or attachment behavior from
  `flomo-bridge`.
