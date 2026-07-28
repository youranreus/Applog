"""Trusted local Garmin login and encrypted token provisioning CLI."""

import os
from getpass import getpass

from .credential import decode_key
from .repository import MySQLRepository


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
    repository = MySQLRepository.from_environment(
        decode_key(os.environ["GARMIN_TOKEN_ENCRYPTION_KEY"])
    )
    try:
        repository.store_credential(api.client.dumps())
    finally:
        repository.close()
    print("Garmin token encrypted and stored; password and MFA code were discarded.")


if __name__ == "__main__":
    main()
