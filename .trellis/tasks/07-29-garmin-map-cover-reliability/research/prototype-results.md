# Protomaps implementation and local prototype results

Date: 2026-07-29

## Completed locally

- Generated the pinned `@protomaps/basemaps` 5.7.2 light style: 71 layers,
  Chinese font stack, loopback glyph/source URLs, and no external URLs or sprites.
- Verified the public Victoria Park PMTiles fixture with official PMTiles CLI
  1.31.2. It contains four MVT tiles at z12–14, is 465 KiB, and matches SHA-256
  `e1d3a5d3ccfbf24a928d120411a3ba853564a4871684feb40f5a6eeef0a6b812`.
- Rendered and visually inspected deterministic 480×480 route, point, soccer
  heatmap, and explicit no-map covers through a fake clean-basemap seam. Route
  occupancy preserves the 32px target area; soccer density remains aligned with
  geographic coordinates and no longer uses an illustrated pitch.
- Passed 78 worker tests, Ruff, shell syntax validation, `git diff --check`, and
  the `@applog/common` TypeScript build.

## Linux production gate still required

Martin server-side static rendering is Linux-only. This workstation is Apple
Silicon macOS and has no Docker, Podman, or Colima runtime, so it cannot honestly
complete the real-renderer gate. Before activating a production fingerprint, run
the checked-in prototype on the deployment Linux host with the pinned Martin
binary and a real release:

```bash
python -m garmin_sync.map_release verify RELEASE_DIR \
  --pmtiles /usr/local/bin/pmtiles --martin /usr/local/bin/martin
python -m garmin_sync.map_prototype \
  --manifest RELEASE_DIR/manifest.json \
  --output /tmp/applog-map-prototype --iterations 100 \
  --renderer-pid MARTIN_PID
```

The release remains blocked from production activation until the report shows
100 map successes, acceptable latency/WebP sizes, an RSS plateau, and the four
fixture images pass human inspection. Two real releases must then be activated
forward and backward with health checks to close the rollback gate.
