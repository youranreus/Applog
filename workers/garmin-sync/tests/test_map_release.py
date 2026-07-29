import hashlib
import json
from pathlib import Path

import pytest

from garmin_sync.map_release import activate_release, verify_release

PUBLIC_FIXTURE_SHA256 = (
    "e1d3a5d3ccfbf24a928d120411a3ba853564a4871684feb40f5a6eeef0a6b812"
)


def build_release(tmp_path, *, external_style=False, renderer_hash=None):
    release = tmp_path / "maps" / "releases" / "release-1"
    release.mkdir(parents=True)
    (release / "fonts").mkdir()
    (release / "fonts" / "NotoSans.ttf").write_bytes(b"synthetic-public-font")
    (release / "basemap.pmtiles").write_bytes(b"PMTiles-synthetic-fixture")
    style = {
        "version": 8,
        "glyphs": (
            "https://fonts.example.com/{fontstack}/{range}"
            if external_style
            else "http://127.0.0.1:3000/font/{fontstack}/{range}"
        ),
        "sources": {
            "protomaps": {
                "type": "vector",
                "url": "http://127.0.0.1:3000/basemap",
            }
        },
        "layers": [],
    }
    (release / "style.json").write_text(json.dumps(style))
    assets = {
        name: hashlib.sha256((release / name).read_bytes()).hexdigest()
        for name in ("basemap.pmtiles", "style.json")
    }
    manifest = {
                "releaseId": "release-1",
                "styleId": "applog-light",
                "styleVersion": "5.7.2",
                "rendererVersion": "1.11.0",
                "regions": [
                    {"id": "fixture", "bounds": [-1, -1, 1, 1], "maxZoom": 24}
                ],
                "assets": assets,
            }
    if renderer_hash is not None:
        manifest["rendererSha256"] = renderer_hash
    (release / "manifest.json").write_text(json.dumps(manifest))
    return release


def test_release_verifier_rejects_external_style_dependencies(tmp_path):
    release = build_release(tmp_path, external_style=True)

    with pytest.raises(ValueError, match="external_style_url"):
        verify_release(release)


def test_release_verifier_requires_a_local_font_file(tmp_path):
    release = build_release(tmp_path)
    (release / "fonts" / "NotoSans.ttf").unlink()

    with pytest.raises(ValueError, match="fonts_missing"):
        verify_release(release)


def test_release_verifier_rejects_asset_paths_outside_release(tmp_path):
    release = build_release(tmp_path)
    outside = release.parent / "outside"
    outside.write_bytes(b"not-a-release-asset")
    manifest_path = release / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["assets"]["../outside"] = hashlib.sha256(
        outside.read_bytes()
    ).hexdigest()
    manifest_path.write_text(json.dumps(manifest))

    with pytest.raises(ValueError, match="asset_outside_release"):
        verify_release(release)


def test_release_activation_is_atomic_and_keeps_release_directory(tmp_path):
    release = build_release(tmp_path)
    maps_root = tmp_path / "maps"

    verify_release(release)
    activate_release(release, maps_root)

    assert (maps_root / "current").resolve() == release.resolve()
    assert release.is_dir()


def test_release_verifier_checks_pinned_renderer_binary(tmp_path):
    martin = tmp_path / "martin"
    martin.write_bytes(b"pinned-martin-binary")
    release = build_release(
        tmp_path,
        renderer_hash=hashlib.sha256(martin.read_bytes()).hexdigest(),
    )

    verify_release(release, martin_binary=martin)
    martin.write_bytes(b"unexpected-binary")
    with pytest.raises(ValueError, match="renderer_hash_mismatch"):
        verify_release(release, martin_binary=martin)


def test_checked_in_public_fixture_matches_its_manifest():
    maps_path = Path(__file__).parents[1] / "maps"
    manifest = json.loads(
        (maps_path / "fixtures" / "public-victoria-park-20260728.json").read_text()
    )
    fixture = maps_path / "fixtures" / manifest["asset"]

    assert manifest["assetSha256"] == PUBLIC_FIXTURE_SHA256
    assert hashlib.sha256(fixture.read_bytes()).hexdigest() == PUBLIC_FIXTURE_SHA256
    assert manifest["bounds"] == [114.18, 22.278, 114.195, 22.289]
    assert manifest["attribution"] == "© OpenStreetMap contributors"
