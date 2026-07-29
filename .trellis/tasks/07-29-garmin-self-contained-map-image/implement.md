# Garmin 自包含地图渲染镜像实施计划

## 0. Pre-development gate

- [x] Obtain explicit approval of the final PRD/design/plan summary.
- [x] Run `task.py start` and `trellis-before-dev` before product-file edits.
- [ ] Record exact production architecture and pin all builder/runtime image digests.

## 1. Create the project-specific image

- [x] Add `workers/garmin-sync/maps/Dockerfile` with exact PMTiles, asset-builder and Martin runtime stages.
- [x] Add a container-specific Martin config that listens inside the container while keeping every style/font/tile URL loopback-only.
- [x] Generate and verify global z0-6 plus Greater Bay Area z7-15 `basemap.pmtiles` from an explicit build URL/hash.
- [x] Generate `applog-light` with `@protomaps/basemaps@5.7.2`, install/copy the two required Noto font families, and bake NOTICE/licenses.
- [x] Generate the immutable manifest and OCI labels from the same release metadata; ensure no secret/private inputs enter the build context.
- [x] Add `.dockerignore` coverage if needed so local env files, virtualenvs, task data and private artifacts cannot enter layers.

## 2. Preserve the worker manifest contract

- [x] Provide a deterministic command to export the image-baked `manifest.json` to `/opt/applog/maps/current/manifest.json` before starting the worker.
- [x] Document ordering so manifest export, renderer replacement and health verification are atomic from the worker's perspective.
- [x] Keep `GARMIN_MAP_RENDERER_URL` loopback-only and avoid changes to cover evidence/viewport/quality behavior.

## 3. Add operational documentation

- [x] Update `workers/garmin-sync/maps/README.md` and `docs/garmin-sync.md` with exact build arguments, Docker/Compose run command, host loopback binding, manifest export, health/prototype checks and digest rollback.
- [x] Include explicit warnings against `latest`, public port publishing, runtime asset volumes, private bbox derivation and secrets in build args.

## 4. Automated verification

- [x] Add a fast structural test/lint that parses the Dockerfile/config and rejects floating tool versions, external runtime URLs, root runtime, missing healthcheck and missing release assets.
- [x] Add an opt-in Linux Docker integration test that builds the tiny public fixture mode without production coverage.
- [ ] Run the container with no outbound network, no map volumes, read-only root, dropped capabilities and host loopback publishing.
- [ ] Assert `/health` plus fixture map requests return valid 960×960 WebP.
- [ ] Run `python -m garmin_sync.map_prototype --fixture-profile victoria-park --iterations 100` against the container.
- [x] Run worker Ruff and full pytest; run repository lint/type-check only for touched non-worker files.

## 5. Production release verification

- [ ] Build one real release for the production architecture with explicit upstream BLAKE3.
- [ ] Inspect OCI history/config and scan for secrets, private paths and high-severity vulnerabilities.
- [ ] Deploy by digest, export its manifest, verify health, perform one bounded Garmin sync and confirm mapped covers are not downgraded.
- [ ] Repeat with a second image digest, then roll back to prove the atomic image+manifest procedure.

## Rollback points

- Before deployment: no mutable production state; discard failed build/tag.
- After renderer deployment but before sync: restart previous image digest and restore its exported manifest.
- After sync: use previous renderer digest; immutable cover records and monotonic cover quality preserve prior successful images.
