# Garmin 地图封面可靠性设计

## Architecture

```text
Garmin private data
  ├─ route points
  └─ archived weather payload
          │
          ▼
CoverLocationResolver ── route | point(activity/weather) | none
          │
          ▼
WebMercatorViewport ── center + floating zoom + 32px safe area
          │
          ├───────────────┐
          ▼               ▼
localhost renderer      OverlayComposer
(Martin preferred)      route / marker / heat density
          │               │
          └──── clean 2× basemap ────┘
                          │
                          ▼
             480×480 WebP + render metadata
                          │
                          ▼
          existing immutable cover storage / Landing
```

The renderer is infrastructure, not the owner of activity semantics. It receives only a camera, output size, and style ID. Python owns evidence selection, viewport math, overlays, privacy, fallback decisions, versioning, and database writes.

## Boundaries and Contracts

### Location evidence

Introduce private value objects conceptually equivalent to:

```python
LocationEvidence(kind="route", points=[...], provenance="activity")
LocationEvidence(kind="point", points=[...], provenance="activity" | "weather")
LocationEvidence(kind="none", points=[], provenance=None)
```

- Coordinate validation and consecutive de-duplication happen once at this boundary.
- Route data has priority. One distinct route point becomes an activity point.
- If route data is absent, resolve a weather point from the encrypted private archive. Existing archived activities must be readable for regeneration; resolution cannot depend only on payloads fetched during the current sync.
- Coordinates and provenance never cross into the public snapshot DTO. Structured logs hash the source activity ID and emit only coarse error/coverage codes.

### Viewport

Create one Web Mercator viewport module used by every cover type.

- Normalize longitude with explicit antimeridian handling.
- Calculate the continuous zoom that maps the dominant geometry span into 416px at 480×480, leaving a 32px target margin on both dominant-axis edges.
- Render at 960×960 with the same logical camera; convert overlay points through that camera and double all logical pixel widths.
- A single point uses a configured fixed zoom capped by the selected region package's maxzoom.
- The module returns `center`, `zoom`, logical pixel projection helpers, and coverage requirements. It never renders.
- Pixel-bound tests inspect the final 480px image. No post-overlay crop is allowed.

### Local renderer HTTP seam

Define a small adapter such as:

```text
GET {loopback}/style/{style_id}/static/{lon},{lat},{zoom}/480x480@2x.webp
```

The Python client enforces:

- loopback-only base URL;
- short connect/total timeout and one in-flight request;
- success status, `image/webp`, actual 960×960 dimensions, and non-empty/non-uniform raster validation;
- response size limit;
- typed failure result rather than broad exception swallowing.

Martin is pinned after the prototype establishes a working version/digest. Its style points only to local PMTiles, glyph and sprite endpoints. If Martin cannot satisfy the acceptance suite, TileServer GL implements the same internal `BasemapRenderer.render(camera)` contract.

### Overlay composition

- Route: fixed high-contrast stroke after basemap rendering, with start/end dots. Stroke width does not change with route extent.
- Point: one accessible marker centered on the evidence point; weather provenance is metadata only and is not printed publicly.
- Soccer: project the original GPS samples directly through the viewport, accumulate density on a bounded raster grid, blur/colorize it, then alpha-composite over the basemap. Do not rotate or normalize samples into an illustrated pitch.
- Attribution continues through the existing cover metadata and is rendered by Landing's `garmin-cover__attribution` overlay; snapshot tests must keep it visible and prevent the distance badge from obscuring it. The bitmap itself stays reusable and does not duplicate attribution pixels.
- Final encode strips EXIF/GPS metadata and emits the existing content hash/immutable cover record.

### Result and quality model

Replace provider-name ranking as the sole quality signal with activity- and evidence-aware quality. For the same known evidence, a mapped overlay outranks its local fallback and no-map; route evidence outranks a point so a temporarily missing route cannot downgrade to a point, and soccer heatmap is terminal only while the activity remains soccer with valid samples:

```text
soccer+samples: map_heatmap > local_heatmap-disabled > point/no_map
route evidence: map_route > local_route > map_point/local_point > no_map
point evidence: map_point > local_point > no_map
no evidence: no_map
```

The stored provider/fingerprint includes renderer family, pinned renderer version, style version, PMTiles release ID and overlay version. A failure result carries a typed reason but no coordinates. Repository replacement remains monotonic: a failed regeneration never replaces an existing mapped cover.

## Protomaps Release Layout

Production assets live outside Git in an immutable deployment artifact or object store:

```text
maps/releases/<release-id>/
  bay-area.pmtiles
  global-z0-6.pmtiles
  style.json
  fonts/
  sprites/
  manifest.json
  LICENSES/
maps/current -> releases/<release-id>
```

`manifest.json` records source/build date, schema/style versions, bbox, maxzoom, BLAKE3/hash, renderer compatibility and attribution. Git contains the schema/template, styles, NOTICE, and a tiny public fixture only.

Update monthly using an explicit upstream build URL:

1. Download/extract to a new release directory.
2. Verify upstream hash and `pmtiles verify`.
3. Start the pinned renderer on a temporary port and run offline visual/geometry fixtures.
4. Atomically switch the complete release and restart the loopback service.
5. Raise the application render fingerprint only after health and smoke checks pass.
6. Retain the prior complete release. Rollback switches the whole PMTiles/style/font/sprite set, never one file in isolation.

## Sync and Migration

- The newest-six candidate loop resolves cover evidence independently of whether a public coordinate-free SVG route is already marked processed.
- Existing private weather payloads are read only inside the worker to enable elliptical regeneration.
- Cover currentness is based on the new fingerprint and activity-aware quality; old `carto-dark/v3`, `local-route/v3`, `local/v3`, and `local-heatmap/v3` become eligible for bounded regeneration.
- Preserve the current route/detail batch limits. Rebuilding old covers must not create an unbounded Garmin upstream fetch.
- Existing successful cover remains referenced until a new cover has fully rendered, validated and committed transactionally.

## Deployment and Security

- Add an `applog-map-renderer.service` running under a low-privilege account/group, bound to `127.0.0.1`, with release assets mounted read-only and a dedicated runtime/cache directory.
- Garmin service orders after/wants the renderer and probes `/health`, while still being able to publish snapshots using the last good covers if renderer health fails.
- No map token or cloud credential is introduced. Remove the production dependency on remote tile configuration after migration.
- Do not log request URLs because they contain camera coordinates. Metrics use result class, release fingerprint, duration and coarse coverage region only.

## Prototype Gate

Before database integration, a CLI prototype must verify:

1. Protomaps v4 layers, Chinese glyphs, sprites, local PMTiles and light style render correctly.
2. Floating zoom, `@2x` dimensions, antimeridian, point/short/loop/long routes and Python-to-renderer camera agreement are within 2px.
3. Rendering succeeds with outbound network blocked and makes no hidden external resource request.
4. One process renders 100 sequential mixed images without blanks or sustained RSS growth; record cold/hot latency, CPU/RSS and WebP size.
5. Two real releases can move forward and roll back as a complete asset set.

Failure of the Martin-specific parts switches the renderer implementation to TileServer GL. Failure of PMTiles/style/data correctness blocks integration because it would alter the promised MVP behavior.

## Trade-offs and Deferred Items

- Self-hosting eliminates subscription and remote availability risk but adds a renderer service and monthly data-release operation.
- Global z0–6 is deliberately small; it gives broad context but not street detail. New high-detail regions are a manual follow-up driven by coarse missing-region metrics.
- Protomaps/ODbL rights permit this storage model, but public map display in mainland China may require separate legal and mapping-regulation review.
- Tencent and Amap remain deferred. A future domestic provider adapter would need a consistent WGS84→GCJ-02 transformation for camera and every overlay point plus explicit storage/compositing rights.

## Rollback

- Application rollback: revert the render fingerprint/code; existing immutable covers remain addressable.
- Renderer rollback: point `maps/current` and renderer config to the prior complete release, restart, verify health and fixed fixtures.
- Generation failure: retain the existing mapped cover; if no prior cover exists, store the typed local/no-map fallback without claiming map success.
