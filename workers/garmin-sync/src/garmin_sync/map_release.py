"""Verify and atomically activate immutable local map releases."""

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import urllib.parse
from collections.abc import Iterable
from pathlib import Path

from .map_renderer import LOOPBACK_HOSTS, MapReleaseManifest


def _strings(value: object) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def verify_release(
    release: Path,
    *,
    pmtiles_binary: Path | None = None,
    martin_binary: Path | None = None,
) -> None:
    """Fail closed on incomplete, network-dependent, or corrupt releases."""
    release = release.resolve(strict=True)
    manifest_path = release / "manifest.json"
    style_path = release / "style.json"
    basemap_path = release / "basemap.pmtiles"
    fonts_path = release / "fonts"
    for required in (manifest_path, style_path, basemap_path, fonts_path):
        if not required.exists():
            raise ValueError(f"map_release_missing:{required.name}")
    MapReleaseManifest.load(manifest_path)
    raw_manifest = json.loads(manifest_path.read_text())
    assets = raw_manifest.get("assets")
    if not isinstance(assets, dict):
        raise ValueError("map_release_assets_missing")
    for relative, expected in assets.items():
        asset = (release / str(relative)).resolve()
        if not asset.is_relative_to(release):
            raise ValueError(f"map_release_asset_outside_release:{relative}")
        if not asset.is_file() or _sha256(asset) != str(expected):
            raise ValueError(f"map_release_hash_mismatch:{relative}")
    style = json.loads(style_path.read_text())
    for value in _strings(style):
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme in {"http", "https"} and parsed.hostname not in LOOPBACK_HOSTS:
            raise ValueError("map_release_external_style_url")
    if not any(
        any(fonts_path.rglob(pattern)) for pattern in ("*.ttf", "*.otf", "*.ttc")
    ):
        raise ValueError("map_release_fonts_missing")
    if martin_binary is not None:
        expected_renderer_hash = raw_manifest.get("rendererSha256")
        if not isinstance(expected_renderer_hash, str):
            raise ValueError("map_release_renderer_hash_missing")
        if _sha256(martin_binary.resolve(strict=True)) != expected_renderer_hash:
            raise ValueError("map_release_renderer_hash_mismatch")
    if pmtiles_binary is not None:
        subprocess.run(
            [str(pmtiles_binary.resolve(strict=True)), "verify", str(basemap_path)],
            check=True,
        )


def activate_release(release: Path, maps_root: Path) -> None:
    """Atomically switch `current` after verification, preserving old releases."""
    release = release.resolve(strict=True)
    maps_root = maps_root.resolve(strict=True)
    releases_root = (maps_root / "releases").resolve(strict=True)
    if release.parent != releases_root:
        raise ValueError("map_release_outside_releases_root")
    verify_release(release)
    temporary = maps_root / f".current-{os.getpid()}-{secrets.token_hex(6)}"
    try:
        temporary.symlink_to(release)
        os.replace(temporary, maps_root / "current")
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify = subparsers.add_parser("verify")
    verify.add_argument("release", type=Path)
    verify.add_argument("--pmtiles", type=Path)
    verify.add_argument("--martin", type=Path)
    activate = subparsers.add_parser("activate")
    activate.add_argument("release", type=Path)
    activate.add_argument("maps_root", type=Path)
    args = parser.parse_args()
    if args.command == "verify":
        verify_release(
            args.release,
            pmtiles_binary=args.pmtiles,
            martin_binary=args.martin,
        )
    else:
        activate_release(args.release, args.maps_root)


if __name__ == "__main__":
    main()
