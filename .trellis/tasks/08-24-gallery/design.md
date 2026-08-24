# 相册功能技术设计

## 1. 设计目标

在不复制第二套内容管理界面的前提下，增加一个照片优先的公开相册：管理配置留在现有 Dashboard，内容管理发生在公开相册页本身；OSS 凭证永不进入浏览器，公开请求只读取数据库投影并通过 CDN 加载图片。

本任务保持单一 Trellis 任务。配置、存储、公开 API 和用户端页面属于同一个强耦合数据流，拆成可独立启动的子任务会在中间状态留下不可验收的跨层契约。

## 2. 架构边界

```text
Dashboard GallerySettings
  -> admin config API
  -> GalleryConfigEntity
  -> SecretEncryptionService
  -> GalleryOssAdapter (connection probe / object operations)

Gallery page
  -> public gallery APIs -> Album/Photo database projection
  -> CDN URL -------------> OSS display object

Admin on Gallery page
  -> admin album/photo APIs
  -> GalleryService
  -> temp-file/image processor -> OSS source/display objects
  -> GalleryAlbumEntity / GalleryPhotoEntity
```

- `@applog/common` owns stable gallery DTOs, masks, limits, status literals, and pure path/URL helpers shared by frontend/backend.
- `packages/backend/src/module/gallery/` owns auth, validation, object-storage orchestration, EXIF normalization, and persistence.
- `packages/frontend/src/pages/Gallery/` owns the public experience and the administrator-only inline controls.
- Existing `SystemSettings.vue` gains one `GallerySettings.vue` section; it does not gain album or photo management.

## 3. Persistence model

### 3.1 `GalleryConfigEntity` (singleton id = 1)

- OSS: `endpoint`, `bucket`, `accessKeyId` and encrypted `accessKeySecret` envelope fields.
- Delivery: normalized HTTPS `cdnDomain` and normalized `galleryPath`.
- State: `enabled`, `configRevision`, `verifiedRevision`, `verifiedAt`.
- Credential encryption adds immutable purpose `gallery.oss-credential` to `SecretEncryptionService`.
- Admin readback returns the secret mask. Blank/mask submission preserves the existing secret.
- Changing any OSS/CDN/path value increments `configRevision`, clears verification, and forces `enabled=false`. A no-op masked save does not invalidate verification.
- Enabling requires `verifiedRevision === configRevision` and a complete configuration.

### 3.2 `GalleryAlbumEntity`

- Numeric primary key plus opaque `publicId`.
- `folder` is a unique immutable safe slug used in OSS keys.
- Editable `title`, optional `description`, and `publishedAt`.
- `createdAt` / `updatedAt` follow existing entity conventions.
- Public ordering is `(publishedAt ASC, id ASC)`.
- Public album summaries include photo count and the earliest ready photo as cover; empty albums are visible to admins but omitted publicly.

### 3.3 `GalleryPhotoEntity`

- Numeric primary key, opaque `publicId`, and explicit `albumId` relation.
- Storage: `sourceObjectKey`, `displayObjectKey`, source/display MIME, byte size, width, height, and `storageState` (`ready`, `deleting`, `delete_failed`).
- Display metadata: optional title/description, `takenAt`, editable `publishedAt`, optional latitude/longitude, and an allowlisted EXIF JSON projection.
- Public ordering is `(publishedAt ASC, id ASC)` and public queries include only `ready` rows.
- The original client filename is admin-only diagnostic metadata and is never used as an OSS key.

TypeORM `synchronize: true` remains the repository's schema mechanism. All new entities are registered in `ENTITY_LIST` and `GalleryModule.forFeature(...)`.

## 4. OSS configuration and verification

The gallery uses a dedicated admin API, not generic `SYSTEM_*` read/write routes.

Connection testing uses the currently saved configuration and a single deterministic probe key under `{galleryPath}/.applog-probe`:

1. list at most one object under the gallery prefix;
2. delete the deterministic probe key before creating anything, proving delete authorization without accumulating probes;
3. upload a small non-sensitive probe payload;
4. read/head the object through the configured CDN domain;
5. delete the probe in `finally`;
6. set `verifiedRevision` only if every step and cleanup succeeded.

A transient post-upload cleanup failure leaves at most the same deterministic probe key; the next test begins by deleting it. Logs include request/category context but never credentials.

## 5. Object key and URL contract

- Album folder accepts a conservative slug (`a-z`, `0-9`, `-`, `_`), rejects separators, dot segments, control characters, and encoded traversal.
- Server-generated UUID filenames eliminate collisions and conceal original filenames.
- Public display key: `{galleryPath}/{folder}/{uuid}.{displayExt}`.
- HEIC source key: `{galleryPath}/.originals/{folder}/{uuid}.heic`.
- Other formats may use the display object as their source object when no conversion is needed.
- Public display URL: normalized `{cdnDomain}/{displayObjectKey}`. The shared helper removes duplicate slashes while preserving `https://` and percent-encodes path segments exactly once.
- Public DTOs expose display URLs only. Source keys and credentials never cross the public boundary.
- UUID display objects are immutable and CDN-cacheable; metadata edits do not rename them.

## 6. Upload and HEIC processing

- The UI accepts up to 20 selected files and sends one authenticated multipart request per file with bounded concurrency (two). This avoids a single request containing up to 600 MB.
- Fastify multipart limits each file to 30 MB. The backend streams each upload to a managed temporary file, validates magic bytes and dimensions, and always unlinks the temporary file in `finally`.
- Accepted source formats: JPEG, PNG, WebP, HEIC. SVG/GIF and mismatched MIME/extension payloads fail before OSS writes.
- `exifr` extracts an allowlist: camera make/model, lens, focal length, aperture, exposure, ISO, exposure bias, orientation, dimensions, capture time, and GPS.
- Capture time precedence: EXIF `DateTimeOriginal` with offset, then other EXIF capture time, then upload time. Offset-less EXIF values use the upload client's timezone offset; the admin can correct `publishedAt`.
- GPS is stored as numeric latitude/longitude after range validation. Raw maker notes and arbitrary EXIF objects are discarded.
- HEIC is decoded by a `GalleryImageProcessor` backed by Sharp linked to a libvips build with libheif/HEVC decoding. It emits a high-quality, auto-oriented JPEG display object while preserving the HEIC source object.
- A repository-owned HEIC capability doctor/fixture verifies the actual self-hosted runtime. Missing capability rejects HEIC uploads with a specific diagnostic without breaking JPEG/PNG/WebP browsing; production acceptance requires the doctor to pass.
- Upload writes source/display objects first, then inserts the ready database row. Database failure triggers best-effort deletion of every written object; partial cleanup is logged with object identifiers only.

## 7. Delete and consistency behavior

- Deleting a photo first changes its row to `deleting`, making it disappear from public reads immediately.
- The service deletes all distinct source/display keys, then removes the database row.
- If any OSS deletion fails, the row becomes `delete_failed`; admins see a retry action while public users continue not to see it.
- A non-empty album check counts all photo rows, including `deleting`/`delete_failed`, and rejects deletion until storage cleanup completes.
- MVP does not move photos across albums, perform bulk cascade deletion, or implement a recycle bin.

## 8. API contracts

Public routes omit `@AuthRoles`:

- `GET /gallery/status` -> `{ enabled }`, never credentials.
- `GET /gallery/albums` -> ordered non-empty summaries.
- `GET /gallery/albums/:publicId/photos?cursor&limit` -> ascending keyset page.
- `GET /gallery/photos/:publicId` -> full safe photo metadata for the Dialog.

When disabled, status returns `enabled:false`; all content routes reject with a clear “相册未开启” business error and never return retained rows.

Admin routes use `@AuthRoles('admin')`:

- `GET|PUT /gallery/admin/config`
- `POST /gallery/admin/config/test`
- `POST /gallery/admin/albums`
- `PATCH|DELETE /gallery/admin/albums/:publicId`
- `POST /gallery/admin/albums/:publicId/photos` (one file)
- `PATCH|DELETE /gallery/admin/photos/:publicId`
- retrying a failed delete reuses the idempotent delete endpoint.

Input DTOs use `class-validator`; controllers remain thin. Shared response contracts live in `@applog/common`, while decorated request DTOs remain backend-local.

## 9. User experience direction

Surface mode: **Experience** for visitors, with a conditional **Operate** layer for administrators. It inherits the existing restrained Apple visual system.

- The “相册窗口” first viewport lets the active album's cover photo lead at large scale. A quiet typographic album rail shows title, date, and count without becoming a dashboard.
- Selecting an album keeps the cover as a visual anchor and reveals its photos in a stable row-major chronological grid. Tiles may crop for the index, but the Dialog always preserves the full display aspect ratio.
- Administrator actions appear as a compact toolbar and per-item contextual actions only when authenticated as admin. Forms reuse existing Dialog/Field/Button primitives and never replace the photo surface with a management table.
- Upload progress is per photo; partial success remains visible and retryable. Empty, loading, disabled, upload-failure, delete-failure, and no-GPS states receive explicit copy.
- The full-screen Dialog uses the image as the dominant region and a fixed-width metadata rail on desktop. On narrow screens it stacks image then metadata, retains a visible close action, traps focus, supports Escape, and restores focus to the triggering thumbnail.
- MapCN Vue/MapLibre is lazy-loaded only when an opened photo has valid GPS. It renders one marker in a small map; missing GPS hides the region and tile/style failure falls back to coordinates without blocking preview.
- Motion is limited to album/photo continuity and Dialog entry, respects `prefers-reduced-motion`, and never delays content visibility.

## 10. Navigation and frontend state

- Add a public `/gallery` route and a stable `ROUTE_NAMES.GALLERY` constant.
- `useLayoutStore` requests `GET /gallery/status` alongside nav pages and includes the configured gallery nav source only when enabled.
- The gallery page uses API factories under `src/api/gallery/` and page hooks for album selection, keyset loading, upload queue, and admin mutations. The route SFC stays orchestration-only.
- Administrator UI checks `USER_ROLES.ADMIN` for visibility, but backend roles remain the authority.
- After config enable/disable, album mutation, upload, edit, or delete, only the owning gallery/status requests are refreshed; no full page reload is required.

## 11. Compatibility, rollout, and rollback

- Existing installations have no gallery rows; status defaults to disabled and no new nav item appears.
- Saving configuration never enables the feature automatically. Operators test, then explicitly enable.
- Disabling is the immediate rollback: it hides navigation and blocks public data while preserving configuration, albums, database metadata, and OSS objects.
- Code rollback leaves additive tables/objects intact. No destructive downgrade step is required.
- `APP_SECRET_ENCRYPTION_KEY` remains the sole master key; adding the gallery purpose changes no existing envelope format.
- Map tiles and CDN failures degrade locally. The API still serves metadata, and image/map failures do not erase database state.

## 12. Key trade-offs

- Preserving HEIC originals costs additional OSS storage but avoids irreversible quality loss and allows future reprocessing.
- Backend-proxied uploads keep long-lived credentials out of the browser and avoid bucket CORS/STS scope, at the cost of server bandwidth and temporary disk usage.
- Immutable album folders avoid risky mass OSS renames; editable display titles preserve user-facing flexibility.
- Blocking non-empty album deletion adds steps but prevents accidental batch loss.
- A single photo per upload request gives reliable progress/retry and bounded memory; the UI still presents it as one batch action.

## 13. Sources

See `research/gallery-integration.md` for repository evidence and primary MapCN, HEIC, EXIF, and OSS sources.
