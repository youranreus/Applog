"""Trusted local Garmin login and encrypted token provisioning CLI."""

import os
from getpass import getpass

from .repository import MySQLRepository
from .secret_encryption import decode_master_key, derive_key


def main() -> None:
    """Prompt for ephemeral credentials and persist only encrypted tokens."""
    from garminconnect import Garmin

    email = input("Garmin email: ").strip()
    password = getpass("Garmin password (will not be stored): ")
    is_cn = os.getenv("GARMIN_IS_CN", "true").casefold() == "true"
    api = Garmin(
        email=email,
        password=password,
        is_cn=is_cn,
        prompt_mfa=lambda: input("Garmin MFA code: ").strip(),
        retry_attempts=1,
    )
    api.login()
    master_key = decode_master_key(os.environ["APP_SECRET_ENCRYPTION_KEY"])
    repository = MySQLRepository.from_environment(
        derive_key(master_key, "garmin.credential")
    )
    try:
        repository.store_credential(api.client.dumps())
    finally:
        repository.close()
    print("Garmin token encrypted and stored; password and MFA code were discarded.")


if __name__ == "__main__":
    main()
