# Garmin 地图封面可靠性实施计划

## 0. Pre-development gate

- [x] Run `trellis-before-dev` and load the Garmin backend and shared quality/spec guidance.
- [x] Confirm the task remains planning-only until the user approves the final summary and `task.py start` is run in a later turn.
- [x] Record the current renderer/config/cover DB state with redacted diagnostics for rollback comparison.

## 1. Build the isolated Protomaps prototype

- [x] Add a tiny public PMTiles fixture plus manifest/ODbL NOTICE; keep production assets outside Git.
- [x] Package a light, low-saturation Protomaps style with all font and sprite dependencies local.
- [x] Pin a candidate Martin version/digest and configure a loopback-only local service.
- [x] Implement a no-database prototype client for camera static WebP requests and raster validation.
- [ ] Run the five prototype gates in `design.md`, capture measured results in task research, and select Martin or the TileServer GL fallback before integration.
- [ ] Stop if neither renderer passes the same localhost contract; do not hide the failure behind the current route-only cover.

## 2. Introduce evidence and viewport modules

- [x] Add private location-evidence normalization for route, activity point, weather point and none.
- [x] Add a repository accessor that decrypts only the required archived weather payload inside the worker; do not create public coordinate columns.
- [x] Implement antimeridian-safe Web Mercator camera/projection with 32px target margin and a capped point zoom.
- [x] Add deterministic tests for invalid/repeated/single points, track loops, short/long/aspect-ratio routes and antimeridian cases.

Likely files: `workers/garmin-sync/src/garmin_sync/cover.py`, new focused renderer/viewport modules, `sync.py`, `repository.py`, `models.py`, and worker tests.

## 3. Replace the cover composition pipeline

- [x] Fetch and validate a clean 960×960 basemap from the selected localhost renderer.
- [x] Draw route, point marker and soccer heat density after basemap rendering with the same camera.
- [x] Remove the post-render `_crop_route_to_padding` path and the pure illustrated soccer pitch from the production flow.
- [x] Encode to 480×480 WebP without EXIF/GPS metadata and preserve deterministic content hashing.
- [x] Implement typed generation results and structured, coordinate-free error logging; remove broad silent exception swallowing.
- [x] Update activity-aware quality/currentness so degraded retries never overwrite successful mapped covers.

## 4. Wire sync and bounded migration

- [x] Resolve weather evidence from current or archived private payloads for newest-six candidates.
- [x] Keep route/detail upstream work bounded and avoid re-fetch loops for indoor activities.
- [x] Bump the composite render fingerprint and make old CARTO/local/pitch covers eligible for gradual regeneration.
- [ ] Verify elliptical with weather gets a point map, coordinate-free elliptical gets no-map, runs get mapped routes, and soccer gets mapped heat density.
- [x] Confirm public DTOs and logs contain no raw coordinates, bbox, provenance or private payload data.

## 5. Package release and systemd operations

- [x] Add the pinned renderer install/config contract and `applog-map-renderer.service`; bind only to loopback and use read-only release assets.
- [x] Update Garmin provisioning to install/order/health-check the renderer without making snapshot publication depend on a successful new cover.
- [x] Add release manifest validation, explicit-version download/extract/verify, atomic activation and prior-release rollback commands/docs.
- [x] Remove production reliance on CARTO tile environment variables after successful migration while retaining a safe code rollback path.
- [x] Document monthly update and coarse missing-region review.

## 6. Validation

- [x] Worker unit suite: `cd workers/garmin-sync && python -m pytest`.
- [x] Worker lint: `cd workers/garmin-sync && python -m ruff check .`.
- [ ] Prototype offline/100-image/resource/release-rollback suite from `design.md`.
- [x] Pixel assertions: 480×480, route dominant span 414–418px with 2px antialias tolerance, no overlay outside safe area, heatmap alignment ≤2px.
- [x] Privacy assertions: no EXIF/GPS metadata and no coordinate keys/values in public responses or captured logs.
- [x] Failure matrix: renderer down, timeout, bad content type, wrong dimensions, blank raster, missing assets, uncovered region and invalid geometry.
- [ ] Integration smoke on the latest six private activities; inspect generated images before switching the production fingerprint.
- [ ] Run the relevant backend/common/frontend Garmin contract tests if attribution or public cover metadata changes.

## 7. Review and rollout

- [x] Run `trellis-check` for spec compliance, tests and cross-layer privacy flow.
- [x] Update `.trellis/spec/backend/backend/garmin-guidelines.md` to replace the stale CARTO/integer-crop/pure-pitch contracts with the accepted Protomaps/evidence/viewport contracts.
- [ ] Deploy renderer and one map release first; verify health and fixed fixtures.
- [ ] Deploy worker code, regenerate only the bounded newest-six set, and compare cover providers/fingerprints and screenshots.
- [ ] Roll back the complete map release or application version on failed health/pixel/privacy checks; immutable old covers remain available.

## Risky Files and Rollback Points

- `cover.py` / new viewport module: pixel geometry and privacy; retain golden fixtures and the prior render version until rollout passes.
- `repository.py`: encrypted payload access and cover replacement transaction; require focused repository tests before any production sync.
- `sync.py`: batch budgets and currentness; verify no unbounded Garmin API requests.
- `provision.py` and systemd units: service ordering/permissions; validate on a staging Linux host because Martin static rendering is Linux-only.
- Map release manifest/style/assets: activate atomically as one unit and keep the previous release intact.
