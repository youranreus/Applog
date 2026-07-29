# syntax=docker/dockerfile:1.12

ARG PMTILES_IMAGE=protomaps/go-pmtiles:v1.31.2
ARG NODE_IMAGE=node:24.14.1-bookworm
ARG GO_IMAGE=golang:1.25.6-bookworm
ARG MARTIN_IMAGE=ghcr.io/maplibre/martin:1.12.0

FROM ${PMTILES_IMAGE} AS pmtiles

FROM ${MARTIN_IMAGE} AS martin

FROM ${NODE_IMAGE} AS assets

ARG BUILD_MODE=fixture
ARG PROTOMAPS_BUILD_DATE
ARG PROTOMAPS_BUILD_URL
ARG PROTOMAPS_BUILD_BLAKE3
ARG RELEASE_ID
ARG MARTIN_IMAGE_DIGEST=development-unverified
ARG MARTIN_IMAGE=ghcr.io/maplibre/martin:1.12.0
ARG PMTILES_IMAGE=protomaps/go-pmtiles:v1.31.2
ARG NODE_IMAGE=node:24.14.1-bookworm
ARG GO_IMAGE=golang:1.25.6-bookworm

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      ca-certificates \
      fonts-noto-cjk \
      fonts-noto-core \
      jq \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pmtiles /go-pmtiles /usr/local/bin/pmtiles
COPY --from=martin /usr/local/bin/martin /build/martin
COPY workers/garmin-sync/maps/generate-style.mjs /build/generate-style.mjs
COPY workers/garmin-sync/maps/build-release.sh /build/build-release.sh
COPY workers/garmin-sync/maps/verify-release.mjs /build/verify-release.mjs
COPY workers/garmin-sync/maps/NOTICE.md /build/NOTICE.md
COPY workers/garmin-sync/maps/fixtures /build/fixtures

WORKDIR /build
RUN npm install --ignore-scripts --no-save --no-package-lock \
      @protomaps/basemaps@5.7.2 \
    && chmod 0755 /build/build-release.sh \
    && BUILD_MODE="${BUILD_MODE}" \
       PROTOMAPS_BUILD_DATE="${PROTOMAPS_BUILD_DATE}" \
       PROTOMAPS_BUILD_URL="${PROTOMAPS_BUILD_URL}" \
       PROTOMAPS_BUILD_BLAKE3="${PROTOMAPS_BUILD_BLAKE3}" \
       RELEASE_ID="${RELEASE_ID}" \
       MARTIN_IMAGE_DIGEST="${MARTIN_IMAGE_DIGEST}" \
       MARTIN_IMAGE_REF="${MARTIN_IMAGE}" \
       PMTILES_IMAGE_REF="${PMTILES_IMAGE}" \
       NODE_IMAGE_REF="${NODE_IMAGE}" \
       GO_IMAGE_REF="${GO_IMAGE}" \
       /build/build-release.sh /opt/applog/maps/current

FROM ${GO_IMAGE} AS healthprobe

COPY workers/garmin-sync/maps/healthcheck.go /src/healthcheck.go
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' \
    -o /out/applog-map-health /src/healthcheck.go

FROM martin AS runtime

ARG RELEASE_ID=fixture-public-victoria-park-20260728
ARG PROTOMAPS_BUILD_DATE=20260728
ARG PROTOMAPS_BUILD_BLAKE3=fixture-not-a-planet-build
ARG SOURCE_REVISION=development-uncommitted
ARG PMTILES_IMAGE=protomaps/go-pmtiles:v1.31.2
ARG NODE_IMAGE=node:24.14.1-bookworm
ARG GO_IMAGE=golang:1.25.6-bookworm

LABEL org.opencontainers.image.title="AppLog Garmin map renderer" \
      org.opencontainers.image.description="Offline Martin renderer for AppLog Garmin covers" \
      org.opencontainers.image.licenses="Apache-2.0 AND BSD-3-Clause AND ODbL-1.0" \
      org.opencontainers.image.revision="${SOURCE_REVISION}" \
      io.applog.maps.release-id="${RELEASE_ID}" \
      io.applog.maps.protomaps-build-date="${PROTOMAPS_BUILD_DATE}" \
      io.applog.maps.protomaps-build-blake3="${PROTOMAPS_BUILD_BLAKE3}" \
      io.applog.maps.martin-version="1.12.0" \
      io.applog.maps.pmtiles-version="1.31.2" \
      io.applog.maps.style-version="5.7.2" \
      io.applog.maps.attribution="© OpenStreetMap contributors" \
      io.applog.maps.license-path="/opt/applog/maps/current/LICENSES" \
      io.applog.build.pmtiles-image="${PMTILES_IMAGE}" \
      io.applog.build.node-image="${NODE_IMAGE}" \
      io.applog.build.go-image="${GO_IMAGE}"

COPY --from=assets --chown=10001:10001 /opt/applog/maps/current /opt/applog/maps/current
COPY --from=healthprobe --chown=10001:10001 /out/applog-map-health /usr/local/bin/applog-map-health
COPY --chown=10001:10001 workers/garmin-sync/maps/martin.container.yaml /etc/applog/martin.yaml

USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=4 \
  CMD ["/usr/local/bin/applog-map-health"]

CMD ["--config", "/etc/applog/martin.yaml"]
