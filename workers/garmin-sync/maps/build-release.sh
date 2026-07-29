#!/usr/bin/env bash

set -euo pipefail

readonly release_dir="${1:?release output directory is required}"
readonly build_mode="${BUILD_MODE:-fixture}"
readonly style_version="5.7.2"
readonly renderer_version="1.12.0"
readonly fixture_id="public-victoria-park-20260728"

fail() {
  echo "AppLog map image build: $*" >&2
  exit 1
}

require_non_placeholder() {
  local name="$1"
  local value="${!name:-}"
  [[ -n "${value}" ]] || fail "${name} is required"
  [[ "${value}" != *replace-with* ]] || fail "${name} is still a placeholder"
}

require_digest_reference() {
  local name="$1"
  local value="${!name:-}"
  [[ "${value}" =~ @sha256:[0-9a-f]{64}$ ]] || \
    fail "${name} must be pinned by OCI sha256 digest"
}

mkdir -p "${release_dir}/fonts" "${release_dir}/LICENSES"

case "${build_mode}" in
  fixture)
    cp "/build/fixtures/${fixture_id}.pmtiles" "${release_dir}/basemap.pmtiles"
    release_id="${RELEASE_ID:-fixture-${fixture_id}}"
    source_url="fixture://${fixture_id}"
    source_hash="$(jq -r '.assetSha256' "/build/fixtures/${fixture_id}.json")"
    # Martin can overzoom the z14 fixture tiles for the z15+ cover cameras.
    regions='[{"id":"public-victoria-park","bounds":[114.18,22.278,114.195,22.289],"maxZoom":24}]'
    ;;
  production)
    require_non_placeholder PROTOMAPS_BUILD_DATE
    require_non_placeholder PROTOMAPS_BUILD_URL
    require_non_placeholder PROTOMAPS_BUILD_BLAKE3
    require_non_placeholder MARTIN_IMAGE_DIGEST
    require_digest_reference MARTIN_IMAGE_REF
    require_digest_reference PMTILES_IMAGE_REF
    require_digest_reference NODE_IMAGE_REF
    require_digest_reference GO_IMAGE_REF
    [[ "${PROTOMAPS_BUILD_DATE}" =~ ^[0-9]{8}$ ]] || \
      fail "PROTOMAPS_BUILD_DATE must use YYYYMMDD"
    [[ "${PROTOMAPS_BUILD_URL}" == https://* ]] || \
      fail "PROTOMAPS_BUILD_URL must use HTTPS"
    [[ "${MARTIN_IMAGE_DIGEST}" == sha256:* ]] || \
      fail "MARTIN_IMAGE_DIGEST must be an OCI sha256 digest"
    [[ "${PROTOMAPS_BUILD_BLAKE3}" =~ ^[0-9a-fA-F]{64}$ ]] || \
      fail "PROTOMAPS_BUILD_BLAKE3 must be a 64-character BLAKE3 hash"
    [[ "${MARTIN_IMAGE_REF:-}" == *@"${MARTIN_IMAGE_DIGEST}" ]] || \
      fail "MARTIN_IMAGE must be pinned to MARTIN_IMAGE_DIGEST"
    work_dir="$(mktemp -d)"
    trap 'rm -rf "${work_dir}"' EXIT
    # The PMTiles CLI reads only the required byte ranges from the immutable
    # remote archive. The official whole-archive BLAKE3 is provenance metadata;
    # it cannot be reverified from these partial HTTP Range responses.
    pmtiles extract "${PROTOMAPS_BUILD_URL}" "${work_dir}/global.pmtiles" \
      --maxzoom=6
    pmtiles extract "${PROTOMAPS_BUILD_URL}" "${work_dir}/bay-area.pmtiles" \
      --bbox=111.5,21.5,115.5,24.0 --minzoom=7 --maxzoom=15
    pmtiles merge "${work_dir}/global.pmtiles" \
      "${work_dir}/bay-area.pmtiles" "${release_dir}/basemap.pmtiles"
    release_id="${RELEASE_ID:-${PROTOMAPS_BUILD_DATE}-protomaps}"
    source_url="${PROTOMAPS_BUILD_URL}"
    source_hash="${PROTOMAPS_BUILD_BLAKE3}"
    source_hash_verification="upstream-provenance-only"
    regions='[{"id":"greater-bay-area","bounds":[111.5,21.5,115.5,24.0],"maxZoom":24},{"id":"global-low","bounds":[-180,-85,180,85],"maxZoom":6}]'
    ;;
  *)
    fail "BUILD_MODE must be fixture or production"
    ;;
esac

source_hash_verification="${source_hash_verification:-fixture-asset-sha256}"

pmtiles verify "${release_dir}/basemap.pmtiles"

APPLOG_MAP_STYLE_OUTPUT="${release_dir}/style.json" \
  node /build/generate-style.mjs

cp /usr/share/fonts/truetype/noto/NotoSans-Regular.ttf \
  "${release_dir}/fonts/NotoSans-Regular.ttf"
cp /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc \
  "${release_dir}/fonts/NotoSansCJK-Regular.ttc"
cp /usr/share/doc/fonts-noto-core/copyright \
  "${release_dir}/LICENSES/Noto-Sans-OFL.txt"
cp /usr/share/doc/fonts-noto-cjk/copyright \
  "${release_dir}/LICENSES/Noto-Sans-CJK-OFL.txt"

cp /build/NOTICE.md "${release_dir}/LICENSES/NOTICE.md"

if jq -r '.. | strings' "${release_dir}/style.json" |
  grep -E '^https?://' |
  grep -Ev '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?(/|$)'; then
  fail "style contains a non-loopback runtime URL"
fi

assets='{}'
while IFS= read -r -d '' asset; do
  relative="${asset#"${release_dir}/"}"
  digest="$(sha256sum "${asset}" | awk '{print $1}')"
  assets="$(jq --arg path "${relative}" --arg digest "${digest}" \
    '. + {($path): $digest}' <<<"${assets}")"
done < <(find "${release_dir}" -type f ! -name manifest.json -print0 | sort -z)

jq -n \
  --arg release_id "${release_id}" \
  --arg style_version "${style_version}" \
  --arg renderer_version "${renderer_version}" \
  --arg renderer_digest "${MARTIN_IMAGE_DIGEST:-fixture-unverified}" \
  --arg renderer_sha256 "$(sha256sum /build/martin | awk '{print $1}')" \
  --arg source_build_date "${PROTOMAPS_BUILD_DATE:-20260728}" \
  --arg source_url "${source_url}" \
  --arg source_hash "${source_hash}" \
  --arg source_hash_verification "${source_hash_verification}" \
  --argjson regions "${regions}" \
  --argjson assets "${assets}" \
  '{
    releaseId: $release_id,
    styleId: "applog-light",
    styleVersion: $style_version,
    rendererVersion: $renderer_version,
    rendererSha256: $renderer_sha256,
    rendererImageDigest: $renderer_digest,
    pmtilesCliVersion: "1.31.2",
    sourceBuildDate: $source_build_date,
    sourceBuildUrl: $source_url,
    sourceBuildHash: $source_hash,
    sourceBuildHashVerification: $source_hash_verification,
    attribution: "© OpenStreetMap contributors",
    regions: $regions,
    assets: $assets
  }' >"${release_dir}/manifest.json"

node /build/verify-release.mjs "${release_dir}"

echo "AppLog map image build: release ${release_id} verified"
