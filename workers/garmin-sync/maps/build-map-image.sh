#!/usr/bin/env bash

set -euo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly repo_root="$(cd -- "${script_dir}/../../.." && pwd)"
readonly dockerfile="workers/garmin-sync/maps/Dockerfile"

mode="${1:-fixture}"
image_tag="${2:-applog-map-renderer:fixture}"

fail() {
  echo "AppLog map image: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_value() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "${name} is required for production"
}

require_digest_ref() {
  local name="$1"
  local value="${!name:-}"
  [[ "${value}" =~ @sha256:[0-9a-f]{64}$ ]] || \
    fail "${name} must end with @sha256:<64 lowercase hex characters>"
}

require_command docker

build_args=(
  --file "${dockerfile}"
  --tag "${image_tag}"
)

if [[ "${NO_CACHE:-0}" == "1" ]]; then
  build_args+=(--no-cache)
fi

case "${mode}" in
  fixture)
    build_args+=(
      --build-arg BUILD_MODE=fixture
      --build-arg RELEASE_ID="${RELEASE_ID:-fixture-public-victoria-park-20260728}"
    )
    ;;
  production)
    require_command git
    for name in PROTOMAPS_BUILD_DATE PROTOMAPS_BUILD_URL PROTOMAPS_BUILD_BLAKE3; do
      require_value "${name}"
    done
    for name in MARTIN_IMAGE PMTILES_IMAGE NODE_IMAGE GO_IMAGE; do
      require_digest_ref "${name}"
    done
    [[ "${PROTOMAPS_BUILD_DATE}" =~ ^[0-9]{8}$ ]] || \
      fail "PROTOMAPS_BUILD_DATE must use YYYYMMDD"
    [[ "${PROTOMAPS_BUILD_URL}" == https://* ]] || \
      fail "PROTOMAPS_BUILD_URL must use HTTPS"
    [[ "${PROTOMAPS_BUILD_BLAKE3}" =~ ^[0-9a-fA-F]{64}$ ]] || \
      fail "PROTOMAPS_BUILD_BLAKE3 must contain 64 hex characters"

    SOURCE_REVISION="$(git -C "${repo_root}" rev-parse HEAD)"
    MARTIN_IMAGE_DIGEST="${MARTIN_IMAGE##*@}"
    image_tag="${2:-applog-map-renderer:${PROTOMAPS_BUILD_DATE}}"
    build_args[3]="${image_tag}"
    build_args+=(
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
