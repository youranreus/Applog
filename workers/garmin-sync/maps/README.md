# AppLog Protomaps release assets

The repository contains only reproducible configuration, licenses and test
fixtures. Production PMTiles and activity-derived images stay outside Git.

## Self-contained Docker image

`Dockerfile` builds the one-purpose AppLog renderer. The final image contains
Martin, one immutable PMTiles release, the `applog-light` style, Noto fonts,
the release manifest and notices. It needs no runtime asset volume and must not
have outbound network access. Use the repository root as the build context so
`Dockerfile.dockerignore` can reduce it to the public map build inputs.

Fast public-fixture build for CI and host validation:

```bash
./workers/garmin-sync/maps/build-map-image.sh
```

Pass an explicit tag as the second argument when needed. Set `NO_CACHE=1` to
force a clean rebuild:

```bash
NO_CACHE=1 ./workers/garmin-sync/maps/build-map-image.sh \
  fixture applog-map-renderer:fixture
```

Production builds are also one command. The script selects the newest official
Protomaps build that publishes a BLAKE3, pulls the four pinned base-image tags,
resolves their immutable OCI digests, and tags the result with the build date:

```bash
./workers/garmin-sync/maps/build-map-image.sh production
```

Pass a second argument to choose the output tag. To reproduce a specific daily
build, set only its date; the script resolves its official URL and BLAKE3:

```bash
PROTOMAPS_BUILD_DATE=20260728 \
  ./workers/garmin-sync/maps/build-map-image.sh production applog-map-renderer:v1
```

The following expanded form documents the values resolved by the script.
Never use `latest`, infer a bbox from private activities, or pass
Garmin/database secrets as build arguments:

```bash
docker pull ghcr.io/maplibre/martin:1.12.0
MARTIN_DIGEST="$(docker image inspect ghcr.io/maplibre/martin:1.12.0 \
  --format '{{index .RepoDigests 0}}' | sed 's/.*@//')"

# Resolve these three exact digest references from the approved registries.
PMTILES_IMAGE=protomaps/go-pmtiles@sha256:REPLACE_WITH_PMtiles_DIGEST
NODE_IMAGE=node@sha256:REPLACE_WITH_NODE_DIGEST
GO_IMAGE=golang@sha256:REPLACE_WITH_GO_DIGEST

docker build \
  --file workers/garmin-sync/maps/Dockerfile \
  --tag registry.example/applog-map-renderer:20260728 \
  --build-arg BUILD_MODE=production \
  --build-arg PROTOMAPS_BUILD_DATE=20260728 \
  --build-arg PROTOMAPS_BUILD_URL=https://build.protomaps.com/20260728.pmtiles \
  --build-arg PROTOMAPS_BUILD_BLAKE3=REPLACE_WITH_OFFICIAL_BUILD_HASH \
  --build-arg RELEASE_ID=20260728-protomaps \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  --build-arg PMTILES_IMAGE="${PMTILES_IMAGE}" \
  --build-arg NODE_IMAGE="${NODE_IMAGE}" \
  --build-arg GO_IMAGE="${GO_IMAGE}" \
  --build-arg MARTIN_IMAGE="ghcr.io/maplibre/martin@${MARTIN_DIGEST}" \
  --build-arg MARTIN_IMAGE_DIGEST="${MARTIN_DIGEST}" \
  .
```

For production, also pass digest-pinned `PMTILES_IMAGE`, `NODE_IMAGE`, and
`GO_IMAGE` build arguments. The Dockerfile defaults document exact versions for
fixture builds; digest-qualified image references are the production trust
boundary. The build rejects a Martin digest that does not match `MARTIN_IMAGE`.

Production never downloads the complete planet archive. PMTiles CLI reads the
global z0-6 and Greater Bay Area z7-15 extracts directly from
`PROTOMAPS_BUILD_URL` with HTTP Range requests, then merges and verifies the
resulting baked archive. `PROTOMAPS_BUILD_BLAKE3` must be copied from the
official build listing and is recorded as upstream provenance only; the build
does not claim to reverify that whole-archive hash from partial responses. The
baked asset SHA-256 values and `pmtiles verify` remain local build gates.

Stage the baked manifest before replacing the renderer. This is metadata only;
the renderer still runs without volumes. Disable the Garmin timer for the
whole image/manifest switch so the worker cannot observe a mixed release:

```bash
image=registry.example/applog-map-renderer@sha256:REPLACE_WITH_IMAGE_DIGEST
sudo /opt/applog/current/workers/garmin-sync/manage-timer disable
manifest_stage="$(mktemp -d)"
container="$(docker create "${image}")"
docker cp "${container}:/opt/applog/maps/current/manifest.json" \
  "${manifest_stage}/manifest.json"
docker rm "${container}"
```

Start with a read-only root and host-loopback publishing. The container listens
on all interfaces only inside its network namespace; public host publishing is
unsupported:

```bash
docker network inspect applog-map-internal >/dev/null 2>&1 || \
  docker network create applog-map-internal

docker run --detach --name applog-map-renderer \
  --restart unless-stopped \
  --publish 127.0.0.1:3000:3000 \
  --read-only --tmpfs /tmp:size=64m,noexec,nosuid,nodev \
  --cap-drop ALL --security-opt no-new-privileges \
  --network applog-map-internal \
  "${image}"

curl --fail --silent http://127.0.0.1:3000/health

sudo install -d -m 0755 /opt/applog/maps/current
sudo install -m 0644 "${manifest_stage}/manifest.json" \
  /opt/applog/maps/current/.manifest.json.next
sudo mv /opt/applog/maps/current/.manifest.json.next \
  /opt/applog/maps/current/manifest.json
sudo /opt/applog/current/workers/garmin-sync/manage-timer enable
```

The Compose example uses a dedicated bridge because Docker's `internal` networks
block the renderer's loopback-published port on Linux. The port remains bound to
`127.0.0.1`; keep a host firewall deny rule as defense in depth and verify static rendering while
outbound traffic is blocked.

Run the established renderer gate from the host:

```bash
python -m garmin_sync.map_prototype \
  --manifest /opt/applog/maps/current/manifest.json \
  --output /tmp/applog-map-prototype --iterations 100 \
  --renderer-pid "$(docker inspect --format '{{.State.Pid}}' applog-map-renderer)"
```

The public fixture image uses its checked-in Victoria Park extract. Run its
same 100-image gate with `--fixture-profile victoria-park`. On a Linux Docker
host the opt-in integration test performs the build, starts the image on an
egress-disabled network, exports its manifest and runs that gate:

```bash
RUN_MAP_IMAGE_INTEGRATION=1 .venv/bin/python -m pytest \
  tests/test_map_image_integration.py -q
```

Deploy and roll back by complete image digest. Always export the manifest from
the same digest, keep the timer disabled until renderer health passes, and
publish the manifest with an atomic rename. Never mix a manifest from one image
with the assets from another. Keep the previous container/image digest and
manifest until the first bounded sync succeeds so the same sequence can roll
back both pieces.

`fixtures/public-victoria-park-20260728.pmtiles` is a 465 KiB extract around a
fixed public landmark, not a location inferred from any activity. Its adjacent
JSON records the explicit daily build, bbox, zoom range, hash and ODbL notice.
It exists only for renderer integration tests; production coverage must use an
external immutable release.

Pinned toolchain:

- Martin `1.12.0` (exact binary checksum or container digest required)
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

Build one disjoint archive from an explicit Protomaps daily build without
materializing the planet archive:

```bash
pmtiles extract BUILD_URL global.pmtiles --maxzoom=6
pmtiles extract BUILD_URL bay-area.pmtiles \
  --bbox=111.5,21.5,115.5,24.0 --minzoom=7 --maxzoom=15
pmtiles merge global.pmtiles bay-area.pmtiles basemap.pmtiles
pmtiles verify basemap.pmtiles
```

Copy `manifest.example.json`, replace every placeholder, record the official
BLAKE3 as `upstream-provenance-only`, record local asset SHA-256 hashes, and
preserve `NOTICE.md` plus the font licenses. Validate before activation:

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
