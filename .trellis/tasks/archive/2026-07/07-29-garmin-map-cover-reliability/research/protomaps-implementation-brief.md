# Protomaps implementation brief

This is the curated implementation/check context. The complete provider comparison and legal notes remain in `map-provider-evaluation.md`.

## Selected architecture

- MVP uses no paid or online map API. It renders self-hosted Protomaps PMTiles.
- Preferred renderer: an exact pinned Martin version/digest, running as a loopback-only Linux service. Martin currently documents local/remote PMTiles sources plus static PNG/JPEG/WebP output for center/zoom or bbox cameras. It also documents that static rendering is Linux-only, has no concurrency/cache, and may change HTTP shape in a patch release. Sources: [file/PMTiles sources](https://maplibre.org/martin/sources-files/), [styles and static images](https://maplibre.org/martin/sources-styles/), [installation](https://maplibre.org/martin/installation/).
- Martin also provides local font, sprite, health and metrics endpoints: [fonts](https://maplibre.org/martin/sources-fonts/), [sprites](https://maplibre.org/martin/sources-sprites/), [endpoints](https://maplibre.org/martin/using/).
- TileServer GL is the renderer-only fallback if Martin fails the prototype. It supports PMTiles and a mature static image endpoint but adds Node/MapLibre Native/system dependencies: [static endpoints](https://tileserver.readthedocs.io/en/latest/endpoints.html), [PMTiles config](https://tileserver.readthedocs.io/en/latest/config.html), [Linux install](https://tileserver.readthedocs.io/en/stable/installation.html).
- Python owns one Web Mercator camera and all overlays. Renderer auto-fit and post-overlay crop are forbidden. Route, marker, soccer density and basemap use the same camera.

## Offline asset and license boundary

- A complete Protomaps map needs PMTiles, style, glyphs and sprites. All four must be local; no production style may reference a public CDN. Sources: [MapLibre basemap setup](https://docs.protomaps.com/basemaps/maplibre), [security/privacy](https://docs.protomaps.com/guide/security-privacy).
- Protomaps basemap PMTiles are ODbL Produced Works. Preserve `© OpenStreetMap contributors`, ODbL and asset notices: [downloads/license](https://docs.protomaps.com/basemaps/downloads), [OSM copyright](https://www.openstreetmap.org/copyright).
- Production PMTiles and private-location-derived assets do not enter Git. Git contains style, NOTICE, manifest schema/checksum and a tiny public fixture only.

## Release lifecycle

- Initial coverage: Greater Bay Area high detail plus global z0–6. Region limits and maxzoom come from a non-private manifest.
- PMTiles archives are immutable; updates rewrite the archive. Use an explicit upstream build, verify BLAKE3 and `pmtiles verify`, activate the full PMTiles/style/font/sprite release atomically, and retain the previous release. Sources: [basemap builds](https://docs.protomaps.com/basemaps/downloads), [PMTiles CLI](https://docs.protomaps.com/pmtiles/cli), [immutable archive](https://docs.protomaps.com/pmtiles/).
- Update monthly. Never use `latest`, overwrite an active archive, or roll back only PMTiles without its compatible style/assets.

## Prototype gates

Before database integration, verify:

1. Protomaps v4 style, Chinese glyphs, sprites and local PMTiles render correctly.
2. Floating zoom, 960×960 `@2x`, antimeridian and Python/renderer camera agreement are within 2px.
3. Outbound network can be blocked with no hidden resource requests.
4. One process renders 100 sequential mixed cameras without blank images; after warm-up RSS must plateau rather than grow monotonically, and cold/hot latency, CPU/RSS and output size are recorded.
5. Two real complete releases can be activated and rolled back.

Martin-specific failure switches to TileServer GL behind the same localhost adapter. PMTiles/style/data correctness failure blocks product integration rather than silently degrading.
