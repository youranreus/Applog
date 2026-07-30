# 腾讯地图轻量底图实施计划

## Phase 1: Safe spike

- [x] Confirm the active Tencent account's static-map quota, commercial eligibility, Key restrictions and image/cache terms; record evidence without storing the Key.
- [x] Add a test-only Tencent static renderer against public/synthetic mainland fixtures.
- [x] Implement one explicit WGS-84-to-Tencent display-coordinate boundary for camera and overlays.
- [x] Produce 960×960 roadmap images for representative zooms and compare with retained current-map prototypes.
- [x] Measure overlay alignment, response size, quota and failure payloads.
- [x] Stop and reject the provider if alignment exceeds 2 final pixels or usage terms do not permit persisted activity covers (gate passed).

## Phase 2: Provider integration

- [x] Add dedicated server-side Key/config parsing with fail-closed validation.
- [x] Implement `TencentStaticMapRenderer` behind the existing basemap interface.
- [x] Add mainland region gating and integer-zoom safe-area fitting.
- [x] Validate content type/dimensions/byte limit/blank images and map failures to structured categories.
- [x] Parse bounded `X-LIMIT` telemetry without logging URL, Key or coordinates.
- [x] Include provider/style/conversion versions in cover currentness.

## Phase 3: Tests and visual verification

- [x] Unit-test config redaction, URL construction, zoom selection, coordinate conversion and response validation.
- [x] Test route, point, none and football heatmap using local overlays.
- [x] Test mainland boundary, overseas `region_missing`, timeout, quota error, HTTP error and invalid raster.
- [x] Assert outgoing requests contain no path, markers, activity ID or full trace.
- [x] Run paired visual fixtures at zoom 12/15/17 and verify ≤2px alignment plus the 16px target safe area.
- [x] Run the existing worker test suite.
- [x] Run bounded real syncs after the Tencent visual gate passes.

## Phase 4: Deployment simplification

- [x] Document dedicated WebService Key creation, secret configuration, quota telemetry and rollback.
- [x] Roll out to bounded eligible sync batches while preserving old successful covers.
- [x] Remove Martin/PMTiles/manifest from the production deployment path.
- [x] Remove obsolete build assets after user acceptance.

## Validation commands

Use the repository's configured Python environment; exact commands will be confirmed by `trellis-before-dev` before implementation. Expected gates include targeted `test_map_renderer.py`, cover/map integration tests, full Garmin worker tests, and a visual artifact report from public/synthetic fixtures.

## Risk and rollback points

- Coordinate conversion and camera semantics are the first hard gate; do not continue to production integration if they fail.
- Terms/quota verification is a release gate, not an implementation assumption.
- Martin/PMTiles is no longer a runtime rollback path after acceptance.
- Cover persistence prevents provider outages from destroying known-good images; application rollback remains available through Git/deployment history.
