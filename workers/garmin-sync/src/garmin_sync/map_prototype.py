"""Linux prototype gate for the loopback Protomaps static renderer."""

import argparse
import json
import os
import statistics
import time
from pathlib import Path

from .cover import render_point_cover, render_route_cover, render_soccer_heatmap_cover
from .map_renderer import LocalMapRenderer, MapReleaseManifest, RendererConfig

PUBLIC_FIXTURES = {
    "point": [(22.2819, 114.1589)],
    "short-route": [(22.2819, 114.1589), (22.2821, 114.1593)],
    "track-loop": [
        (22.2815, 114.1585),
        (22.2815, 114.1595),
        (22.2822, 114.1595),
        (22.2822, 114.1585),
        (22.2815, 114.1585),
    ],
    "long-route": [(22.24, 113.95), (22.32, 114.25)],
}


def _process_metrics(pid: int) -> tuple[int, int]:
    status = Path(f"/proc/{pid}/status").read_text()
    rss_line = next(line for line in status.splitlines() if line.startswith("VmRSS:"))
    rss_kib = int(rss_line.split()[1])
    stat = Path(f"/proc/{pid}/stat").read_text().split()
    cpu_ticks = int(stat[13]) + int(stat[14])
    return rss_kib, cpu_ticks


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:3000")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--iterations", type=int, default=100)
    parser.add_argument("--renderer-pid", type=int)
    args = parser.parse_args()
    if args.iterations < 1:
        raise ValueError("iterations must be positive")
    args.output.mkdir(parents=True, exist_ok=True)
    renderer = LocalMapRenderer(
        RendererConfig(args.base_url, MapReleaseManifest.load(args.manifest))
    )
    durations: list[float] = []
    rss_samples: list[int] = []
    starting_cpu_ticks = None
    if args.renderer_pid is not None:
        _, starting_cpu_ticks = _process_metrics(args.renderer_pid)
    covers = []
    fixture_items = list(PUBLIC_FIXTURES.items())
    for index in range(args.iterations):
        name, points = fixture_items[index % len(fixture_items)]
        started = time.monotonic()
        if name == "point":
            cover = render_point_cover(
                points[0], provenance="activity", renderer=renderer
            )
        elif name == "track-loop":
            samples = points + [points[1], points[2], points[2]]
            cover = render_soccer_heatmap_cover(samples, renderer=renderer)
        else:
            cover = render_route_cover(points, renderer=renderer)
        durations.append((time.monotonic() - started) * 1000)
        if args.renderer_pid is not None:
            rss_samples.append(_process_metrics(args.renderer_pid)[0])
        if cover.outcome != "map_success":
            raise RuntimeError(f"prototype_render_failed:{cover.failure_category}")
        covers.append(cover)
        if index < len(fixture_items):
            (args.output / f"{name}.webp").write_bytes(cover.image_data)
    ordered = sorted(durations)
    report = {
        "iterations": len(durations),
        "uniqueEtags": len({cover.etag for cover in covers}),
        "latencyMs": {
            "min": round(min(durations), 2),
            "median": round(statistics.median(durations), 2),
            "p95": round(ordered[max(0, round(len(ordered) * 0.95) - 1)], 2),
            "max": round(max(durations), 2),
        },
        "meanWebpBytes": round(
            statistics.mean(len(cover.image_data) for cover in covers)
        ),
    }
    if args.renderer_pid is not None and starting_cpu_ticks is not None:
        ending_rss, ending_cpu_ticks = _process_metrics(args.renderer_pid)
        warm_index = min(10, len(rss_samples) - 1)
        baseline = rss_samples[warm_index]
        allowed_rss = round(baseline * 1.15 + 8192)
        report["renderer"] = {
            "pid": args.renderer_pid,
            "rssKiB": {
                "afterWarmup": baseline,
                "peak": max(rss_samples),
                "final": ending_rss,
                "allowedFinal": allowed_rss,
            },
            "cpuSeconds": round(
                (ending_cpu_ticks - starting_cpu_ticks) / os.sysconf("SC_CLK_TCK"),
                3,
            ),
        }
        if ending_rss > allowed_rss:
            raise RuntimeError("prototype_renderer_rss_did_not_plateau")
    else:
        report["renderer"] = {"resourceGate": "not_measured"}
    (args.output / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
