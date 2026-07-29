# Garmin 自包含地图渲染镜像设计

## Architecture

```text
Docker build (network allowed)
  ├─ pinned PMTiles CLI 1.31.2
  │    ├─ extract global z0-6
  │    ├─ extract Greater Bay Area z7-15
  │    └─ merge + verify basemap.pmtiles
  ├─ Node + @protomaps/basemaps 5.7.2
  │    └─ generate AppLog loopback-only style.json
  ├─ Debian Noto font packages
  ├─ manifest/NOTICE generator + release validator
  └─ exact Martin 1.11.0 runtime base
                     │
                     ▼
immutable OCI image (network not required)
  ├─ Martin executable/runtime libraries
  ├─ /opt/applog/maps/current/basemap.pmtiles
  ├─ /opt/applog/maps/current/style.json
  ├─ /opt/applog/maps/current/fonts/
  ├─ /opt/applog/maps/current/manifest.json
  ├─ /opt/applog/maps/current/LICENSES/
  └─ project-specific martin.yaml + healthcheck
                     │
                     ▼
127.0.0.1:3000 on Linux host → Garmin Python worker
```

## Dockerfile Boundary

Add one project-owned Dockerfile under `workers/garmin-sync/maps/` plus the minimum directly supporting files needed for deterministic construction and documentation. It is not a general image factory: coverage, style id, renderer endpoint, output paths and runtime command are AppLog constants.

Use multi-stage builds:

1. `pmtiles` stage uses the exact official `protomaps/go-pmtiles:v1.31.2` image and copies its CLI into the asset builder.
2. `assets` stage starts from a pinned Node/Debian base, installs only build-time CA/font/hash/JSON tooling, runs the checked-in style generator, extracts and merges one explicit Protomaps daily build, writes checksums/manifest/NOTICE, then verifies the release.
3. `runtime` stage starts from exact `ghcr.io/maplibre/martin:1.11.0`, copies only the immutable release and a container-specific Martin config, switches to the image's non-root execution user, exposes 3000, and defines a localhost healthcheck.

Base image tags must also be captured as OCI digests in the implemented Dockerfile or build documentation before production use. Human-friendly version tags remain as labels, not the trust boundary.

## Build Inputs and Reproducibility

Required build arguments:

- `PROTOMAPS_BUILD_DATE`: explicit `YYYYMMDD`; no latest/default discovery.
- `PROTOMAPS_BUILD_URL`: defaults only by deterministic interpolation from the date and may be overridden for a controlled mirror.
- `PROTOMAPS_BUILD_BLAKE3`: required upstream hash from the official build listing.
- `RELEASE_ID`: derived from the explicit date unless supplied.

Fixed project inputs:

- global coverage z0-6;
- Greater Bay Area bbox `111.5,21.5,115.5,24.0`, z7-15;
- style id `applog-light`;
- Martin `1.11.0`, basemaps `5.7.2`, PMTiles CLI `1.31.2`;
- Noto Sans Regular and Noto Sans CJK SC Regular;
- attribution `© OpenStreetMap contributors`.

BuildKit cache mounts may retain remote PMTiles ranges and npm metadata between builds, but cached files are never runtime inputs without the same verification gates.

## Runtime Contract

Martin listens on `0.0.0.0:3000` inside the container because Docker performs the isolation boundary. The documented host invocation must publish `127.0.0.1:3000:3000`; publishing `0.0.0.0` is explicitly unsupported.

The style's PMTiles and glyph URLs point back to `http://127.0.0.1:3000` inside the same container, so Martin server-side static rendering remains fully offline. The image supports only:

- `/health`;
- Martin catalog/style/font/tile endpoints required internally;
- `/style/applog-light/static/...@2x.webp` used by `LocalMapRenderer`.

The Garmin worker remains outside the container and uses:

```ini
GARMIN_MAP_COVERS_ENABLED=true
GARMIN_MAP_RENDERER_URL=http://127.0.0.1:3000
GARMIN_MAP_RELEASE_MANIFEST=/opt/applog/maps/current/manifest.json
```

Because the worker reads the manifest from the host filesystem today, deployment must extract/copy the baked manifest from the image to a stable host path, or the implementation must add a narrowly scoped manifest endpoint/client contract. Prefer exporting the baked manifest during deployment without changing renderer semantics; the bytes must match the image release exactly.

## Validation and Security

Build fails when:

- upstream BLAKE3 or final asset SHA-256 mismatches;
- `pmtiles verify` fails;
- required Noto fonts are absent;
- manifest assets do not match the baked files;
- style contains any non-loopback HTTP(S) URL;
- Martin/version metadata is incomplete.

Runtime defaults:

- non-root user;
- read-only root filesystem compatible;
- no Linux capabilities;
- `no-new-privileges`;
- no secrets or Garmin data in layers, environment, labels or logs;
- host loopback port publishing only;
- healthcheck without logging static-render camera URLs.

## Image Identity and Rollback

OCI labels record source revision, release id, Protomaps build date/hash, Martin/style/PMTiles versions, OSM attribution and license locations. Production deployment pins the built AppLog image digest. Monthly update creates a new immutable tag/digest; rollback selects the previous digest and re-exports its matching manifest before restart.

## Trade-offs

- The image is large and rebuilds whenever map data changes, but deploy and rollback are one atomic artifact.
- Multi-architecture builds repeat a large data layer unless registry deduplication is available; MVP may validate only the production Linux architecture while keeping the Dockerfile architecture-aware.
- Build time requires stable access to an explicit Protomaps build. Build failure is preferred to substituting another date or partial coverage.

## Rollback

Keep at least the current and previous image digest. A failed build never produces a deployable tag. A failed rollout restarts the prior digest and restores its matching exported manifest; Garmin's monotonic cover policy preserves existing mapped covers during renderer downtime.
