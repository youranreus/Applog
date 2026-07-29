#!/usr/bin/env bash

set -euo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly repo_root="$(cd -- "${script_dir}/../../.." && pwd)"
readonly dockerfile="workers/garmin-sync/maps/Dockerfile"
readonly builds_url="https://build-metadata.protomaps.dev/builds.json"
readonly martin_tag="ghcr.io/maplibre/martin:1.12.0"
readonly pmtiles_tag="protomaps/go-pmtiles:v1.31.2"
readonly node_tag="node:24.14.1-bookworm"
readonly go_tag="golang:1.25.6-bookworm"

mode="${1:-fixture}"

fail() {
  echo "AppLog map image: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_digest_ref() {
  local name="$1"
  local value="${!name:-}"
  [[ "${value}" =~ @sha256:[0-9a-f]{64}$ ]] || \
    fail "${name} must end with @sha256:<64 lowercase hex characters>"
}

resolve_image() {
  local name="$1"
  local tag="$2"
  local value="${!name:-}"
  if [[ -z "${value}" ]]; then
    echo "AppLog map image: resolving ${tag}" >&2
    docker pull "${tag}" >/dev/null
    value="$(docker image inspect "${tag}" \
      --format '{{index .RepoDigests 0}}')"
    printf -v "${name}" '%s' "${value}"
  fi
  require_digest_ref "${name}"
}

resolve_protomaps_build() {
  local requested_date="${PROTOMAPS_BUILD_DATE:-}"
  local selected
  echo "AppLog map image: resolving Protomaps build metadata" >&2
  selected="$({ curl --fail --silent --show-error --location "${builds_url}"; } | \
    python3 -c '
import json
import sys

requested = sys.argv[1]
builds = [item for item in json.load(sys.stdin) if item.get("b3sum")]
if requested:
    builds = [item for item in builds if item["key"] == f"{requested}.pmtiles"]
if not builds:
    raise SystemExit("requested Protomaps build was not found or has no BLAKE3")
selected = max(builds, key=lambda item: item["key"])
print(selected["key"].removesuffix(".pmtiles"), selected["b3sum"])
' "${requested_date}")" || fail "unable to resolve Protomaps build metadata"
  read -r PROTOMAPS_BUILD_DATE PROTOMAPS_BUILD_BLAKE3 <<<"${selected}"
  PROTOMAPS_BUILD_URL="https://build.protomaps.com/${PROTOMAPS_BUILD_DATE}.pmtiles"
}

require_command docker

build_args=(--file "${dockerfile}")

if [[ "${NO_CACHE:-0}" == "1" ]]; then
  build_args+=(--no-cache)
fi

case "${mode}" in
  fixture)
    image_tag="${2:-applog-map-renderer:fixture}"
    build_args+=(
      --tag "${image_tag}"
      --build-arg BUILD_MODE=fixture
      --build-arg RELEASE_ID="${RELEASE_ID:-fixture-public-victoria-park-20260728}"
    )
    ;;
  production)
    require_command git
    require_command curl
    require_command python3
    resolve_protomaps_build
    resolve_image MARTIN_IMAGE "${martin_tag}"
    resolve_image PMTILES_IMAGE "${pmtiles_tag}"
    resolve_image NODE_IMAGE "${node_tag}"
    resolve_image GO_IMAGE "${go_tag}"
    [[ "${PROTOMAPS_BUILD_DATE}" =~ ^[0-9]{8}$ ]] || \
      fail "PROTOMAPS_BUILD_DATE must use YYYYMMDD"
    [[ "${PROTOMAPS_BUILD_URL}" == https://* ]] || \
      fail "PROTOMAPS_BUILD_URL must use HTTPS"
    [[ "${PROTOMAPS_BUILD_BLAKE3}" =~ ^[0-9a-fA-F]{64}$ ]] || \
      fail "PROTOMAPS_BUILD_BLAKE3 must contain 64 hex characters"

    SOURCE_REVISION="$(git -C "${repo_root}" rev-parse HEAD)"
    MARTIN_IMAGE_DIGEST="${MARTIN_IMAGE##*@}"
    image_tag="${2:-applog-map-renderer:${PROTOMAPS_BUILD_DATE}}"
    build_args+=(
      --tag "${image_tag}"
      --build-arg BUILD_MODE=production
      --build-arg PROTOMAPS_BUILD_DATE="${PROTOMAPS_BUILD_DATE}"
      --build-arg PROTOMAPS_BUILD_URL="${PROTOMAPS_BUILD_URL}"
      --build-arg PROTOMAPS_BUILD_BLAKE3="${PROTOMAPS_BUILD_BLAKE3}"
      --build-arg RELEASE_ID="${RELEASE_ID:-${PROTOMAPS_BUILD_DATE}-protomaps}"
      --build-arg SOURCE_REVISION="${SOURCE_REVISION}"
      --build-arg MARTIN_IMAGE="${MARTIN_IMAGE}"
      --build-arg MARTIN_IMAGE_DIGEST="${MARTIN_IMAGE_DIGEST}"
      --build-arg PMTILES_IMAGE="${PMTILES_IMAGE}"
      --build-arg NODE_IMAGE="${NODE_IMAGE}"
      --build-arg GO_IMAGE="${GO_IMAGE}"
    )
    ;;
  *)
    fail "usage: $0 [fixture|production] [image-tag]"
    ;;
esac

echo "AppLog map image: building ${image_tag} (${mode})"
cd "${repo_root}"
exec docker build "${build_args[@]}" "${repo_root}"
