# AppLog Protomaps release assets

The repository contains only reproducible configuration, licenses and test
fixtures. Production PMTiles and activity-derived images stay outside Git.

`fixtures/public-victoria-park-20260728.pmtiles` is a 465 KiB extract around a
fixed public landmark, not a location inferred from any activity. Its adjacent
JSON records the explicit daily build, bbox, zoom range, hash and ODbL notice.
It exists only for renderer integration tests; production coverage must use an
external immutable release.

Pinned toolchain:

- Martin `1.11.0` (exact binary checksum or container digest required)
- `@protomaps/basemaps` `5.7.2`
- PMTiles CLI `1.31.2`

Generate `style.json` in a release staging directory with the exact package:

```bash
npm exec --yes --package=@protomaps/basemaps@5.7.2 -- \
  node ./workers/garmin-sync/maps/generate-style.mjs > style.json
```

The generator removes POI sprite dependencies and retains roads, land, water,
buildings and Chinese labels. Put locally licensed Noto Sans and Noto Sans CJK
font files in `fonts/`; Martin generates glyph ranges on loopback.

Build one disjoint archive from an explicit Protomaps daily build:

```bash
pmtiles extract BUILD_URL global.pmtiles --maxzoom=6
pmtiles extract BUILD_URL bay-area.pmtiles \
  --bbox=111.5,21.5,115.5,24.0 --minzoom=7 --maxzoom=15
pmtiles merge global.pmtiles bay-area.pmtiles basemap.pmtiles
pmtiles verify basemap.pmtiles
```

Copy `manifest.example.json`, replace every placeholder, record SHA-256 hashes,
and preserve `NOTICE.md` plus the font licenses. Validate before activation:

```bash
python -m garmin_sync.map_release verify /opt/applog/maps/releases/RELEASE_ID \
  --pmtiles /usr/local/bin/pmtiles --martin /usr/local/bin/martin
```

Martin is Linux-only for static rendering. Start it with
`APPLOG_MAP_RELEASE_DIR` pointing at the immutable release and the checked-in
`martin.yaml`. Then run the 100-image prototype before activation:

```bash
python -m garmin_sync.map_prototype \
  --manifest /opt/applog/maps/releases/RELEASE_ID/manifest.json \
  --output /tmp/applog-map-prototype --iterations 100 \
  --renderer-pid MARTIN_PID
```

Pass the Martin process ID from `systemctl show --property MainPID`; without it
the image/latency gates still run but the report marks the RSS/CPU gate as not
measured and the release is not production-ready.

Activation always switches the complete release. Keep the previous release:

```bash
python -m garmin_sync.map_release activate \
  /opt/applog/maps/releases/RELEASE_ID /opt/applog/maps
sudo systemctl restart applog-map-renderer.service
curl --fail --silent http://127.0.0.1:3000/health
```
