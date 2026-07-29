from pathlib import Path

MAPS_DIR = Path(__file__).parents[1] / "maps"


def test_dockerfile_is_pinned_and_bakes_the_release() -> None:
    dockerfile = (MAPS_DIR / "Dockerfile").read_text()

    assert "latest" not in dockerfile.casefold()
    assert "protomaps/go-pmtiles:v1.31.2" in dockerfile
    assert "node:24.14.1-bookworm" in dockerfile
    assert "ghcr.io/maplibre/martin:1.11.0" in dockerfile
    assert "@protomaps/basemaps@5.7.2" in dockerfile
    assert "COPY --from=assets" in dockerfile
    assert "/opt/applog/maps/current" in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert "HEALTHCHECK" in dockerfile
    assert "org.opencontainers.image.revision" in dockerfile
    assert "io.applog.maps.license-path" in dockerfile
    assert "COPY --from=martin /usr/local/bin/martin /build/martin" in dockerfile
    release_script = (MAPS_DIR / "build-release.sh").read_text()
    assert "node /build/verify-release.mjs" in release_script


def test_production_build_range_extracts_and_verifies_complete_release() -> None:
    script = (MAPS_DIR / "build-release.sh").read_text()

    assert "curl " not in script
    assert "b3sum" not in script
    assert (
        'pmtiles extract "${PROTOMAPS_BUILD_URL}" "${work_dir}/global.pmtiles"'
        in script
    )
    assert (
        'pmtiles extract "${PROTOMAPS_BUILD_URL}" "${work_dir}/bay-area.pmtiles"'
        in script
    )
    assert '"${work_dir}/source.pmtiles"' not in script
    assert 'pmtiles verify "${release_dir}/basemap.pmtiles"' in script
    assert 'sourceBuildHashVerification: $source_hash_verification' in script
    assert 'source_hash_verification="upstream-provenance-only"' in script
    assert "NotoSans-Regular.ttf" in script
    assert "NotoSansCJK-Regular.ttc" in script
    assert "Noto-Sans-OFL.txt" in script
    assert "Noto-Sans-CJK-OFL.txt" in script
    assert 'rendererImageDigest: $renderer_digest' in script
    assert 'rendererSha256: $renderer_sha256' in script
    assert "require_digest_reference PMTILES_IMAGE_REF" in script
    assert "require_digest_reference NODE_IMAGE_REF" in script
    assert "require_digest_reference GO_IMAGE_REF" in script

    dockerfile = (MAPS_DIR / "Dockerfile").read_text()
    assert "b3sum" not in dockerfile
    assert "curl" not in dockerfile


def test_container_config_only_reads_baked_assets() -> None:
    config = (MAPS_DIR / "martin.container.yaml").read_text()

    assert "listen_addresses: 0.0.0.0:3000" in config
    assert "on_invalid: abort" in config
    assert "basemap: /opt/applog/maps/current/basemap.pmtiles" in config
    assert "- /opt/applog/maps/current/fonts" in config
    assert "applog-light: /opt/applog/maps/current/style.json" in config
    assert "http://" not in config
    assert "https://" not in config


def test_compose_example_is_loopback_only_and_mount_free() -> None:
    compose = (MAPS_DIR / "docker-compose.example.yml").read_text()

    assert '"127.0.0.1:3000:3000"' in compose
    assert "volumes:" not in compose
    assert "read_only: true" in compose
    assert "- ALL" in compose
    assert "- no-new-privileges:true" in compose
    assert "internal: true" in compose


def test_build_context_excludes_secrets_and_private_data() -> None:
    dockerignore = (MAPS_DIR / "Dockerfile.dockerignore").read_text().splitlines()

    assert dockerignore[0] == "**"
    assert not any(".env" in line for line in dockerignore[1:])
    assert not any("packages/backend" in line for line in dockerignore[1:])
    assert not any(".trellis" in line for line in dockerignore[1:])
