"""Server CLI that loads the shared backend dotenv file before dispatch."""

import argparse
import logging
from collections.abc import Sequence
from pathlib import Path

from dotenv import load_dotenv

# Keep aligned with packages/backend/src/utils/const.ts.
ENV_FILE_PRIORITY = (
    ".env.production.local",
    ".env.development.local",
    ".env.production",
    ".env.development",
    ".env",
)


def load_environment(path: Path) -> None:
    """Load a required dotenv file without replacing process-level settings."""
    if not path.is_file():
        raise FileNotFoundError(f"Garmin environment file not found: {path}")
    load_dotenv(dotenv_path=path, override=False)


def load_environment_directory(path: Path) -> None:
    """Load backend dotenv files in the same highest-to-lowest priority order."""
    loaded = False
    for name in ENV_FILE_PRIORITY:
        env_file = path / name
        if env_file.is_file():
            load_dotenv(dotenv_path=env_file, override=False)
            loaded = True
    if not loaded:
        raise FileNotFoundError(f"No AppLog environment files found in: {path}")


def main(argv: Sequence[str] | None = None) -> None:
    """Load configuration and run either synchronization or provisioning."""
    parser = argparse.ArgumentParser(description="Run the AppLog Garmin worker")
    environment = parser.add_mutually_exclusive_group(required=True)
    environment.add_argument(
        "--env-dir",
        type=Path,
        help="directory containing the AppLog backend dotenv files",
    )
    environment.add_argument(
        "--env-file",
        type=Path,
        help="one explicit dotenv file, bypassing directory priority",
    )
    parser.add_argument(
        "command",
        choices=("sync", "provision", "map-health"),
        nargs="?",
        default="sync",
    )
    args = parser.parse_args(argv)
    if args.env_dir is not None:
        load_environment_directory(args.env_dir)
    elif args.env_file is not None:
        load_environment(args.env_file)
    else:  # argparse's required mutually-exclusive group prevents this branch.
        raise AssertionError("environment source was not selected")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    if args.command == "provision":
        from .provision import main as provision

        provision()
        return
    if args.command == "map-health":
        from .map_renderer import check_renderer_health

        if not check_renderer_health():
            raise SystemExit(1)
        print("Protomaps renderer healthy")
        return

    from .handler import handler

    print(handler({}, None))


if __name__ == "__main__":
    main()
