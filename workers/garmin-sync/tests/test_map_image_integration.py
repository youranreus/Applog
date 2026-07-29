import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_MAP_IMAGE_INTEGRATION") != "1" or shutil.which("docker") is None,
    reason="set RUN_MAP_IMAGE_INTEGRATION=1 on a Linux Docker host",
)

PROJECT_DIR = Path(__file__).parents[3]
DOCKERFILE = "workers/garmin-sync/maps/Dockerfile"


def _run(*args: str) -> None:
    subprocess.run(args, cwd=PROJECT_DIR, check=True)


def _free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def test_fixture_image_runs_offline_prototype(tmp_path: Path) -> None:
    suffix = uuid.uuid4().hex[:12]
    image = f"applog-map-renderer-test:{suffix}"
    container = f"applog-map-renderer-test-{suffix}"
    network = f"applog-map-internal-test-{suffix}"
    port = _free_port()
    try:
        _run(
            "docker",
            "build",
            "--file",
            DOCKERFILE,
            "--build-arg",
            "BUILD_MODE=fixture",
            "--tag",
            image,
            ".",
        )
        _run("docker", "network", "create", network)
        _run(
            "docker",
            "run",
            "--detach",
            "--name",
            container,
            "--network",
            network,
            "--publish",
            f"127.0.0.1:{port}:3000",
            "--read-only",
            "--tmpfs",
            "/tmp:size=64m,noexec,nosuid,nodev",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            image,
        )
        for _ in range(30):
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{port}/health", timeout=1
                ) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(1)
        else:
            logs = subprocess.run(
                ["docker", "logs", container],
                cwd=PROJECT_DIR,
                check=False,
                capture_output=True,
                text=True,
            )
            raise AssertionError(
                "fixture renderer did not become healthy\n"
                f"stdout:\n{logs.stdout}\nstderr:\n{logs.stderr}"
            )
        manifest = tmp_path / "manifest.json"
        _run(
            "docker",
            "cp",
            f"{container}:/opt/applog/maps/current/manifest.json",
            str(manifest),
        )
        _run(
            sys.executable,
            "-m",
            "garmin_sync.map_prototype",
            "--manifest",
            str(manifest),
            "--base-url",
            f"http://127.0.0.1:{port}",
            "--output",
            str(tmp_path / "prototype"),
            "--iterations",
            "100",
            "--fixture-profile",
            "victoria-park",
        )
    finally:
        subprocess.run(
            ["docker", "rm", "--force", container],
            cwd=PROJECT_DIR,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            ["docker", "network", "rm", network],
            cwd=PROJECT_DIR,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
