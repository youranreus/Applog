"""Server CLI that loads the shared backend dotenv file before dispatch."""

import argparse
import logging
from collections.abc import Sequence
from pathlib import Path

from dotenv import load_dotenv


def load_environment(path: Path) -> None:
    """Load a required dotenv file without replacing process-level settings."""
    if not path.is_file():
        raise FileNotFoundError(f"Garmin environment file not found: {path}")
    load_dotenv(dotenv_path=path, override=False)


def main(argv: Sequence[str] | None = None) -> None:
    """Load configuration and run either synchronization or provisioning."""
    parser = argparse.ArgumentParser(description="Run the AppLog Garmin worker")
    parser.add_argument(
        "--env-file",
        type=Path,
        required=True,
        help="dotenv file shared with the AppLog backend",
    )
    parser.add_argument(
        "command",
        choices=("sync", "provision"),
        nargs="?",
        default="sync",
    )
    args = parser.parse_args(argv)
    load_environment(args.env_file)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    if args.command == "provision":
        from .provision import main as provision

        provision()
        return

    from .handler import handler

    print(handler({}, None))


if __name__ == "__main__":
    main()
