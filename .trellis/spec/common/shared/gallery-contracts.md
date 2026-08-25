# Gallery Cross-Layer Contract

> Executable contract for the OSS-backed public gallery shared by common,
> backend, and frontend.

## Scenario: OSS-backed two-level public gallery with in-context admin editing

### 1. Scope / Trigger

Apply this contract when changing gallery configuration, storage layout, album
or photo persistence, upload processing, public/admin APIs, navigation,
metadata display, or the MapCN Vue map. The feature crosses encrypted secrets,
MySQL, Alibaba OSS/CDN, NestJS, `@applog/common`, and Vue.

### 2. Signatures

```text
GET    /gallery/status
GET    /gallery/albums
GET    /gallery/albums/:albumId/photos?cursor=&limit=
GET    /gallery/photos/:photoId

GET    /gallery/admin/config
PUT    /gallery/admin/config
POST   /gallery/admin/config/test
GET    /gallery/admin/albums
POST   /gallery/admin/albums
PATCH  /gallery/admin/albums/:albumId
DELETE /gallery/admin/albums/:albumId
GET    /gallery/admin/albums/:albumId/photos?cursor=&limit=
POST   /gallery/admin/albums/:albumId/photos
GET    /gallery/admin/photos/:photoId
PATCH  /gallery/admin/photos/:photoId
DELETE /gallery/admin/photos/:photoId
```

Admin endpoints require `@AuthRoles('admin')`. The upload endpoint accepts one
multipart `file` per request. Shared signatures live in
`packages/common/src/types/gallery.ts`; path helpers live in
`packages/common/src/utils/gallery.ts`.

Database tables are `gallery_config` (singleton id `1`), `gallery_album`, and
`gallery_photo`. Album/photo ordering indexes are `(publishedAt, id)` and
`(albumId, publishedAt, id)` respectively.

### 3. Contracts

#### Configuration and secrets

- Required configuration: `endpoint`, `bucket`, `accessKeyId`, encrypted
  `accessKeySecret`, `cdnDomain`, and `galleryPath`.
- `accessKeySecret` uses the immutable AES-GCM purpose
  `gallery.oss-credential` with record id `gallery-config:1`.
- Admin readback returns `GALLERY_SECRET_MASK`; public APIs never return any
  credential, source object key, or original filename.
- A storage-relevant field change increments `configRevision`, clears
  `verifiedRevision`/`verifiedAt`, and disables the gallery.
- Enabling requires `verifiedRevision === configRevision` and a non-null
  `verifiedAt`. Public status and navigation fail closed.
- Connection testing lists the gallery prefix, removes an old deterministic
  probe, writes `{galleryPath}/.applog-probe`, verifies it through CDN with
  `HEAD`, and deletes it. Failed cleanup fails the test.

#### Storage and URLs

```text
display: {galleryPath}/{albumFolder}/{uuid}.{jpg|png|webp}
HEIC source: {galleryPath}/.originals/{albumFolder}/{uuid}.heic
public URL: {normalizedCdnDomain}/{displayObjectKey}
```

`albumFolder` is immutable after creation and matches
`^[a-z0-9][a-z0-9_-]{0,63}$`. URL/object-key construction must use the shared
normalizers; never concatenate raw user input in a controller or component.

#### Albums, photos, and upload

- Albums and photos sort by `publishedAt ASC, id ASC`.
- Keyset cursors encode the last `(publishedAt, id)` pair.
- Photo `publishedAt` is EXIF capture time when available, otherwise upload
  time; admins may override it.
- Public album lists omit empty albums. Public photo APIs expose only
  `storageState = ready`; admin APIs may expose recovery states.
- Supported uploads: JPEG, PNG, WebP, HEIC/HEIF. Reject SVG and GIF.
- Limit: 30 MiB per file, one file per HTTP request, at most 20 selected files
  with frontend concurrency `2`.
- Validate file signatures against declared MIME before image processing.
- HEIC keeps the original object and creates an auto-oriented JPEG display
  object. Sharp/libvips is preferred; `heic-convert` is the self-hosted fallback.
- Persist only the allowlisted EXIF projection and numeric GPS coordinates. Do
  not persist/return arbitrary maker notes and do not reverse geocode.
- Upload failure deletes every object already written. Photo deletion moves
  `ready|delete_failed -> deleting -> removed`; OSS failure stores
  `delete_failed`, which remains hidden from public reads and retryable by admin.
- A non-empty album cannot be deleted.

#### Frontend

- `/gallery` remains directly addressable when disabled and renders an explicit
  unavailable state; the top-nav item appears only when public status is enabled.
- `/gallery` renders album summaries as cover cards and must not prefetch every
  album's photos. A card links to the directly addressable
  `/gallery/:albumId` detail route; that route loads photos for only the selected
  album and renders missing or invisible album ids as a recoverable not-found
  state.
- Album covers use the shared 8px image radius with title and date overlaid at
  the lower-left. Admin-only empty albums use a stable same-size placeholder.
- The album-list grid is mobile-first: one column by default, two columns from
  `640px`, and three columns from `1100px`. Do not make three columns the base
  rule or postpone the tablet transition until a narrow phone-sized viewport.
- The detail photo masonry has no fixed content max-width. It keeps responsive
  page gutters and column gaps, balances items by image aspect ratio, and uses
  three, two, then one column as the viewport narrows.
- Photo-page state stored in a Vue `reactive` record must be mutated through the
  Proxy returned by reading the record. Do not return the right-hand value of a
  `??=` assignment: that value is the raw object, so a successful response may
  update memory without causing the loading UI to re-render.
- The list and detail pages share the top-gutter formula
  `calc(clamp(6.5rem, 10vh, 8rem) + env(safe-area-inset-top))`. Their first
  content sits at least 24px below the fixed Header; the detail back link must
  also pass a real `elementFromPoint`/coordinate-click check. A correct `href`
  alone is insufficient when another layer owns the hit target.
- Visitors and normal users have no write controls. Admin album create/edit/
  delete stays on the public album-list route; upload and photo edit/delete stay
  on the public album-detail route. Do not add a second gallery-management page.
- The full-screen photo Dialog shows the display image and available EXIF/time
  data. GPS uses MapCN Vue's `@geoql/v-maplibre` integration with coordinate
  order `[longitude, latitude]`; absent GPS hides the map and map failure does
  not break the preview.
- Dialog styles are global because Reka UI teleports content outside the SFC
  scoped-style boundary. Full-screen overrides must reset both legacy
  `transform` and Tailwind v4's individual `translate` property.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Missing/incomplete OSS, CDN, or path config | Cannot test or enable |
| Relevant config changed after a successful test | Invalidate verification and disable |
| OSS list/put, CDN HEAD, or delete probe fails | Test fails; never mark revision verified |
| Gallery disabled | Hide nav; public content APIs reject; route shows unavailable state |
| Non-admin calls an admin endpoint | Auth guard rejects independently of frontend DOM |
| Unsafe folder/path/CDN scheme | DTO/helper rejects before object access |
| Invalid cursor | `BusinessException('分页游标无效')` |
| File exceeds 30 MiB or signature/MIME mismatches | Reject with readable error; no DB row/object residue |
| HEIC cannot be decoded by either processor | Reject HEIC only; other formats remain usable |
| Partial upload/database failure | Delete all written display/source objects |
| OSS photo deletion fails | Persist `delete_failed`; hide publicly; allow admin retry |
| Album contains any photo row | Reject album deletion |
| Missing GPS | Hide map; keep image and metadata usable |
| Map style/tile/WebGL failure | Show coordinate fallback; keep Dialog usable |
| Photo API returns but UI remains loading | Treat as a reactive identity failure; state writes must target the stored Proxy |
| Back link has the correct `/gallery` href but misses coordinate click | Move both page starts below the fixed Header/safe area and verify the hit target |
| Album list remains three columns at tablet or phone widths | Use the mobile-first 1/2/3 column contract and verify computed columns at 390/768/1440 |

### 5. Good / Base / Bad Cases

- Good: save complete config, test the current revision, enable, create an album,
  upload a real HEIC, browse its generated JPEG over CDN, see EXIF/GPS, then
  delete both source and display objects.
- Good frontend: one selected-album response removes the loading state, renders
  its photo tiles, and the visible back link receives a real coordinate click at
  both 1440px and 390px.
- Base: upload a JPEG without EXIF; use upload time, render no map, and expose
  the normalized `{cdn}/{path}/{folder}/{uuid}.jpg` URL.
- Bad: reuse an old successful test after changing CDN/path, accept `../album`,
  publish a `delete_failed` row, expose the HEIC source key, or render admin
  controls based only on client-side hiding.
- Bad frontend: mutate the raw initializer returned by `??=`, or place the back
  link visually underneath the fixed Header even though its route target is valid.

### 6. Tests Required

- Shared: CDN/path normalization, unsafe segments, folder pattern, URL joining.
- Backend unit: secret masking/preservation, revision invalidation, strict probe
  order/cleanup, disabled/public/admin boundaries, stable ordering and cursor.
- Backend upload: real magic bytes, 30 MiB truncation, EXIF allowlist/GPS,
  capture-time precedence, real HEIC-to-JPEG doctor, partial-write and database
  compensation, delete failure/retry, and non-empty album rejection.
- Frontend: navigation fail-closed, disabled/error/loading/content states,
  album-list requests that do not prefetch photos, single-album detail loading,
  invalid-album recovery, visitor/admin DOM boundaries, queue limit and
  concurrency, retry behavior, detail metadata, optional map, and map fallback.
- Browser: verify album-list columns at 1440px, 768px, and 390px, plus the
  full-width masonry at 1440px and 390px. Assert both pages use equal computed
  top padding, keep at least 24px below the Header, preserve responsive gutters/
  gaps and no horizontal
  overflow, full-screen Dialog rect equals the viewport at `(0, 0)`, desktop
  side rail, mobile stack, keyboard close/focus behavior, and map teardown.
- Gallery browser regression: run a real Vue/Vite page against deterministic
  album/photo responses; assert list 3/2/1 columns, detail request count,
  loading disappearance, rendered tile, detail 3/1 columns,
  `scrollWidth <= innerWidth`, shared top padding, Header clearance,
  center-point ownership, and coordinate-click navigation to `/gallery`.
- Gates: common build; backend lint/build/unit/doctor; frontend
  lint/type-check/unit/build; `git diff --check`.

### 7. Wrong vs Correct

```typescript
// Wrong: bypasses shared normalization and leaks raw path ownership to the UI.
const url = `${config.cdnDomain}/${config.galleryPath}/${folder}/${filename}`;

// Correct: build a validated server-owned key, then its public CDN URL.
const key = buildGalleryObjectKey(config.galleryPath, album.folder, filename);
const url = buildGalleryUrl(config.cdnDomain, key);
```

```css
/* Wrong: teleported Dialog does not receive the SFC scoped attribute. */
<style scoped>
.gallery-preview { width: 100vw; transform: none; }
</style>

/* Correct: global selector plus Tailwind v4 individual translate reset. */
<style>
.gallery-preview {
  width: 100vw !important;
  max-width: none !important;
  transform: none !important;
  translate: none !important;
}
</style>
```

```typescript
// Wrong: ??= evaluates to the raw initializer, so later writes bypass Vue's Proxy.
function stateFor(albumId: string) {
  return (albumPhotos[albumId] ??= createPhotoState());
}

// Correct: write first, then read the value back from the reactive record.
function stateFor(albumId: string) {
  if (!albumPhotos[albumId]) albumPhotos[albumId] = createPhotoState();
  return albumPhotos[albumId];
}
```
