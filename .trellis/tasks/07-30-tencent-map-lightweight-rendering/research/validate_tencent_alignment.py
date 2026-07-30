"""Validate local Tencent overlay projection against a public server-side path."""

from __future__ import annotations

import io
import json
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from garmin_sync.cli import load_environment_directory
from garmin_sync.map_renderer import (
    TENCENT_STATIC_MAP_URL,
    TencentRendererConfig,
    TencentStaticMapRenderer,
)
from garmin_sync.spatial import MapCamera

PUBLIC_ROUTE = [
    (22.2840, 114.1870),
    (22.2843, 114.1890),
    (22.2840, 114.1912),
    (22.2825, 114.1920),
    (22.2808, 114.1915),
    (22.2804, 114.1890),
    (22.2808, 114.1870),
    (22.2824, 114.1865),
    (22.2840, 114.1870),
]


def _request(reference_query: dict[str, str]) -> Image.Image:
    url = f"{TENCENT_STATIC_MAP_URL}?{urllib.parse.urlencode(reference_query)}"
    request = urllib.request.Request(url, headers={"Accept": "image/png"})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = response.read(8 * 1024 * 1024 + 1)
    image = Image.open(io.BytesIO(data))
    image.load()
    return image.convert("RGB")


def _mask_bounds(mask: Image.Image) -> tuple[int, int, int, int]:
    bounds = mask.getbbox()
    if bounds is None:
        raise RuntimeError("alignment_mask_empty")
    return bounds


def main() -> None:
    root = Path(__file__).resolve().parents[4]
    load_environment_directory(root / "packages/backend")
    config = TencentRendererConfig.from_environment()
    if config is None:
        raise RuntimeError("tencent_key_missing")
    renderer = TencentStaticMapRenderer(config)
    output = Path(__file__).with_name("visual")
    output.mkdir(exist_ok=True)
    results = []
    for api_zoom in (12, 15, 17):
        camera = MapCamera(22.2824, 114.1892, float(api_zoom - 1))
        clean = renderer.render(camera, PUBLIC_ROUTE)
        center = clean.camera.center_latitude, clean.camera.center_longitude
        path = "|".join(
            ["color:0xff000000", "weight:4"]
            + [
                f"{latitude:.8f},{longitude:.8f}"
                for latitude, longitude in clean.points
            ]
        )
        query = {
            "center": f"{center[0]:.8f},{center[1]:.8f}",
            "zoom": str(api_zoom),
            "size": "480*480",
            "scale": "2",
            "maptype": "roadmap",
            "path": path,
            "key": config.key,
        }
        reference = _request(query)
        difference = ImageChops.difference(reference, clean.image.convert("RGB"))
        server_mask = difference.convert("L").point(
            lambda value: 255 if value > 24 else 0
        )
        local_mask = Image.new("L", reference.size)
        local_points = [
            tuple(value * 2 for value in clean.camera.project(point))
            for point in clean.points
        ]
        ImageDraw.Draw(local_mask).line(
            local_points, fill=255, width=8, joint="curve"
        )
        tolerance_mask = local_mask.filter(ImageFilter.MaxFilter(9))
        server_pixels = sum(value > 0 for value in server_mask.getdata())
        overlap_pixels = sum(
            server > 0 and local > 0
            for server, local in zip(
                server_mask.getdata(), tolerance_mask.getdata(), strict=True
            )
        )
        overlap_ratio = overlap_pixels / server_pixels if server_pixels else 0.0
        server_bounds = _mask_bounds(server_mask)
        local_bounds = _mask_bounds(local_mask)
        max_bound_delta = max(
            abs(server - local)
            for server, local in zip(server_bounds, local_bounds, strict=True)
        )
        local = clean.image.copy()
        ImageDraw.Draw(local).line(
            local_points, fill="#203f3a", width=8, joint="curve"
        )
        reference.save(
            output / f"tencent-alignment-server-path-z{api_zoom}.webp",
            "WEBP",
            quality=90,
        )
        local.convert("RGB").save(
            output / f"tencent-alignment-local-path-z{api_zoom}.webp",
            "WEBP",
            quality=90,
        )
        results.append(
            {
                "apiZoom": api_zoom,
                "serverMaskPixels": server_pixels,
                "overlapWithinTolerance": round(overlap_ratio, 6),
                "maxBoundsDeltaPhysicalPixels": max_bound_delta,
                "maxBoundsDeltaFinalPixels": max_bound_delta / 2,
                "passed": overlap_ratio >= 0.95 and max_bound_delta <= 4,
            }
        )
    quota = renderer.last_quota
    report = {
        "finalPixelTolerance": 2,
        "results": results,
        "quota": (
            {
                "currentQps": quota.current_qps,
                "limitQps": quota.limit_qps,
                "currentPv": quota.current_pv,
                "limitPv": quota.limit_pv,
            }
            if quota is not None
            else None
        ),
        "passed": all(result["passed"] for result in results),
    }
    (output / "tencent-alignment-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps(report, ensure_ascii=False))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
