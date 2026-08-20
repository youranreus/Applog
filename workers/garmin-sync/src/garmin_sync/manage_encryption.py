"""Maintenance-window migration from Garmin-specific keys to the app master key."""

import argparse
import os
import re
import sys
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .cli import load_environment, load_environment_directory
from .credential import (
    EncryptedToken,
    decode_key,
    decrypt_legacy_token,
    decrypt_token,
    encrypt_token,
)
from .payload_codec import (
    EncryptedPayload,
    decrypt_legacy_payload,
    decrypt_payload,
    encrypt_payload,
)
from .secret_encryption import decode_master_key, derive_key

LOCK_NAME = "applog_secret_encryption_migration"
WORKER_LOCK_NAME = "applog_garmin_sync"
BACKUP_ID = re.compile(r"^[a-zA-Z0-9_]{1,48}$")


def _connection() -> Any:
    import pymysql

    return pymysql.connect(
        host=os.getenv("GARMIN_MYSQL_SERVER") or os.environ["MYSQL_SERVER"],
        port=int(os.getenv("GARMIN_MYSQL_PORT") or os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("GARMIN_MYSQL_USER") or os.environ["MYSQL_USER"],
        password=os.getenv("GARMIN_MYSQL_PASSWORD") or os.environ["MYSQL_PASSWORD"],
        database=os.getenv("GARMIN_MYSQL_DATABASE") or os.environ["MYSQL_DATABASE"],
        charset="utf8mb4",
        autocommit=False,
    )


def _legacy_keys() -> tuple[bytes, bytes]:
    return (
        decode_key(os.environ["GARMIN_TOKEN_ENCRYPTION_KEY"]),
        decode_key(os.environ["GARMIN_DATA_ENCRYPTION_KEY"]),
    )


def _current_keys() -> tuple[bytes, bytes]:
    master = decode_master_key(os.environ["APP_SECRET_ENCRYPTION_KEY"])
    return (
        derive_key(master, "garmin.credential"),
        derive_key(master, "garmin.private-payload"),
    )


def _payload(row: tuple[Any, ...], *, legacy: bool) -> EncryptedPayload:
    return EncryptedPayload(
        ciphertext=bytes(row[4]),
        nonce=bytes(row[5]),
        auth_tag=bytes(row[6]),
        content_hash=str(row[7]),
        content_type=str(row[8]),
        compression=str(row[9]),  # type: ignore[arg-type]
        version=int(row[10]),
        key_version=0 if legacy else int(row[11]),
    )


def _read_rows(
    connection: Any,
    *,
    with_key_version: bool,
    credential_table: str = "garmin_credential",
    payload_table: str = "garmin_private_payload",
) -> tuple[Any, list[Any]]:
    with connection.cursor() as cursor:
        token_columns = ", keyVersion" if with_key_version else ""
        cursor.execute(
            "SELECT ciphertext, nonce, authTag, encryptionVersion"
            f"{token_columns} FROM `{credential_table}` WHERE id = 1"
        )
        credential = cursor.fetchone()
        payload_columns = ", keyVersion" if with_key_version else ", 0 AS keyVersion"
        cursor.execute(
            "SELECT id, domain, ownerKey, payloadKind, ciphertext, nonce, authTag, "
            "contentHash, contentType, compression, encryptionVersion"
            f"{payload_columns} FROM `{payload_table}` ORDER BY id"
        )
        payloads = list(cursor.fetchall())
    return credential, payloads


def _validate_source_schema(connection: Any) -> int:
    """Require the additive schema and return the single live envelope version."""
    all_versions: set[int] = set()
    with connection.cursor() as cursor:
        for table in ("garmin_credential", "garmin_private_payload"):
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s "
                "AND COLUMN_NAME = 'keyVersion'",
                (table,),
            )
            if int(cursor.fetchone()[0]) != 1:
                raise RuntimeError(f"{table}.keyVersion schema is not deployed")
            cursor.execute(
                f"SELECT DISTINCT encryptionVersion FROM `{table}`"  # noqa: S608
            )
            versions = {int(row[0]) for row in cursor.fetchall()}
            if versions - {1, 2}:
                raise RuntimeError(
                    "source contains mixed or unsupported envelope versions"
                )
            all_versions.update(versions)
        if len(all_versions) > 1:
            raise RuntimeError("source contains mixed or unsupported envelope versions")
        version = next(iter(all_versions), 1)
        expected_key_version = 1 if version == 2 else 0
        for table in ("garmin_credential", "garmin_private_payload"):
            cursor.execute(
                f"SELECT COUNT(*) FROM `{table}` "  # noqa: S608
                "WHERE keyVersion <> %s",
                (expected_key_version,),
            )
            if int(cursor.fetchone()[0]):
                raise RuntimeError("source contains unsupported key versions")
    return version


def _validate_legacy(
    connection: Any,
    token_key: bytes,
    data_key: bytes,
    *,
    credential_table: str = "garmin_credential",
    payload_table: str = "garmin_private_payload",
) -> tuple[int, int]:
    credential, payloads = _read_rows(
        connection,
        with_key_version=False,
        credential_table=credential_table,
        payload_table=payload_table,
    )
    if credential:
        decrypt_legacy_token(
            EncryptedToken(
                bytes(credential[0]),
                bytes(credential[1]),
                bytes(credential[2]),
                int(credential[3]),
                0,
            ),
            token_key,
        )
    for row in payloads:
        decrypt_legacy_payload(
            _payload(row, legacy=True),
            data_key,
            domain=str(row[1]),
            owner_key=str(row[2]),
            payload_kind=str(row[3]),
        )
    return (1 if credential else 0, len(payloads))


def _validate_current(
    connection: Any, token_key: bytes, data_key: bytes
) -> tuple[int, int]:
    credential, payloads = _read_rows(connection, with_key_version=True)
    if credential:
        decrypt_token(
            EncryptedToken(
                *map(bytes, credential[:3]), int(credential[3]), int(credential[4])
            ),
            token_key,
        )
    for row in payloads:
        decrypt_payload(
            _payload(row, legacy=False),
            data_key,
            domain=str(row[1]),
            owner_key=str(row[2]),
            payload_kind=str(row[3]),
        )
    return (1 if credential else 0, len(payloads))


@contextmanager
def _locked(connection: Any) -> Iterator[None]:
    with connection.cursor() as cursor:
        for lock_name in (LOCK_NAME, WORKER_LOCK_NAME):
            cursor.execute("SELECT GET_LOCK(%s, 0)", (lock_name,))
            if cursor.fetchone()[0] != 1:
                cursor.execute("SELECT RELEASE_LOCK(%s)", (LOCK_NAME,))
                raise RuntimeError("encryption migration or Garmin worker is active")
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            for lock_name in (WORKER_LOCK_NAME, LOCK_NAME):
                cursor.execute("SELECT RELEASE_LOCK(%s)", (lock_name,))


def preflight(*, dry_run: bool = False) -> None:
    del dry_run
    old_token, old_data = _legacy_keys()
    new_token, new_data = _current_keys()
    connection = _connection()
    try:
        with _locked(connection):
            source_version = _validate_source_schema(connection)
            counts = (
                _validate_legacy(connection, old_token, old_data)
                if source_version == 1
                else _validate_current(connection, new_token, new_data)
            )
            print(f"preflight ok credentials={counts[0]} payloads={counts[1]}")
    finally:
        connection.close()


def _backup_tables(backup_id: str) -> tuple[str, str]:
    if not BACKUP_ID.fullmatch(backup_id):
        raise ValueError("backup id must contain only letters, digits, or underscore")
    return f"garmin_credential_backup_{backup_id}", f"garmin_payload_backup_{backup_id}"


def _table_exists(connection: Any, table: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s",
            (table,),
        )
        return int(cursor.fetchone()[0]) == 1


def _ensure_ledger(connection: Any) -> None:
    """Create the non-secret maintenance ledger before source mutation."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS app_secret_encryption_migration (
              backupId VARCHAR(48) PRIMARY KEY,
              phase VARCHAR(32) NOT NULL,
              sourceCredentialCount BIGINT UNSIGNED NOT NULL,
              sourcePayloadCount BIGINT UNSIGNED NOT NULL,
              completedCredentialCount BIGINT UNSIGNED NOT NULL DEFAULT 0,
              completedPayloadCount BIGINT UNSIGNED NOT NULL DEFAULT 0,
              startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                ON UPDATE CURRENT_TIMESTAMP(3),
              completedAt DATETIME(3) NULL
            )
            """
        )
    connection.commit()


def _record_phase(
    connection: Any,
    backup_id: str,
    phase: str,
    source: tuple[int, int],
    completed: tuple[int, int] = (0, 0),
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO app_secret_encryption_migration
              (backupId, phase, sourceCredentialCount, sourcePayloadCount,
               completedCredentialCount, completedPayloadCount, completedAt)
            VALUES (%s, %s, %s, %s, %s, %s,
                    CASE WHEN %s IN ('complete', 'rolled_back')
                         THEN CURRENT_TIMESTAMP(3) ELSE NULL END)
            ON DUPLICATE KEY UPDATE phase = VALUES(phase),
              sourceCredentialCount = VALUES(sourceCredentialCount),
              sourcePayloadCount = VALUES(sourcePayloadCount),
              completedCredentialCount = VALUES(completedCredentialCount),
              completedPayloadCount = VALUES(completedPayloadCount),
              completedAt = VALUES(completedAt)
            """,
            (backup_id, phase, *source, *completed, phase),
        )


def _prepare_backup(
    connection: Any,
    credential_backup: str,
    payload_backup: str,
    source_rows: tuple[Any, list[Any]],
    token_key: bytes,
    data_key: bytes,
) -> tuple[int, int]:
    """Create a complete backup or safely reuse an identical prior backup."""
    existence = (
        _table_exists(connection, credential_backup),
        _table_exists(connection, payload_backup),
    )
    if existence == (False, False):
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE TABLE `{credential_backup}` LIKE garmin_credential")
            cursor.execute(
                f"INSERT INTO `{credential_backup}` SELECT * FROM garmin_credential"
            )
            cursor.execute(
                f"CREATE TABLE `{payload_backup}` LIKE garmin_private_payload"
            )
            cursor.execute(
                f"INSERT INTO `{payload_backup}` SELECT * FROM garmin_private_payload"
            )
        # MySQL DDL auto-commits. Persist both copies before source mutation.
        connection.commit()
    elif existence != (True, True):
        raise RuntimeError("backup is incomplete; use a different backup id")

    backup_rows = _read_rows(
        connection,
        with_key_version=True,
        credential_table=credential_backup,
        payload_table=payload_backup,
    )
    if backup_rows != source_rows:
        raise RuntimeError("existing backup does not match the legacy source")
    return _validate_legacy(
        connection,
        token_key,
        data_key,
        credential_table=credential_backup,
        payload_table=payload_backup,
    )


def migrate(backup_id: str, *, dry_run: bool = False) -> None:
    old_token, old_data = _legacy_keys()
    new_token, new_data = _current_keys()
    connection = _connection()
    credential_backup, payload_backup = _backup_tables(backup_id)
    counts = (0, 0)
    try:
        with _locked(connection):
            source_version = _validate_source_schema(connection)
            if source_version == 2:
                current = _validate_current(connection, new_token, new_data)
                if not all(
                    _table_exists(connection, table)
                    for table in (credential_backup, payload_backup)
                ):
                    raise RuntimeError(
                        "migration is current but named backup is missing"
                    )
                with connection.cursor() as cursor:
                    cursor.execute(f"SELECT COUNT(*) FROM `{credential_backup}`")
                    backup_credentials = int(cursor.fetchone()[0])
                    cursor.execute(f"SELECT COUNT(*) FROM `{payload_backup}`")
                    backup_payloads = int(cursor.fetchone()[0])
                if current != (backup_credentials, backup_payloads):
                    raise RuntimeError("backup and current row counts differ")
                print(
                    f"migration already verified backup={backup_id} "
                    f"credentials={current[0]} payloads={current[1]}"
                )
                return
            counts = _validate_legacy(connection, old_token, old_data)
            if dry_run:
                print(f"dry-run ok credentials={counts[0]} payloads={counts[1]}")
                return
            _ensure_ledger(connection)
            source_rows = _read_rows(connection, with_key_version=True)
            backup_counts = _prepare_backup(
                connection,
                credential_backup,
                payload_backup,
                source_rows,
                old_token,
                old_data,
            )
            if backup_counts != counts:
                raise RuntimeError("backup row count mismatch")
            _record_phase(connection, backup_id, "backed_up", counts)
            connection.commit()
            _record_phase(connection, backup_id, "migrating", counts)
            connection.commit()
            with connection.cursor() as cursor:
                credential, payloads = source_rows
                if credential:
                    plaintext = decrypt_legacy_token(
                        EncryptedToken(
                            bytes(credential[0]),
                            bytes(credential[1]),
                            bytes(credential[2]),
                            1,
                            0,
                        ),
                        old_token,
                    )
                    envelope = encrypt_token(plaintext, new_token)
                    cursor.execute(
                        "UPDATE garmin_credential SET ciphertext=%s, nonce=%s, "
                        "authTag=%s, "
                        "encryptionVersion=2, keyVersion=1 WHERE id=1",
                        (envelope.ciphertext, envelope.nonce, envelope.auth_tag),
                    )
                for row in payloads:
                    value = decrypt_legacy_payload(
                        _payload(row, legacy=True),
                        old_data,
                        domain=str(row[1]),
                        owner_key=str(row[2]),
                        payload_kind=str(row[3]),
                    )
                    envelope = encrypt_payload(
                        value,
                        new_data,
                        domain=str(row[1]),
                        owner_key=str(row[2]),
                        payload_kind=str(row[3]),
                        binary=str(row[9]) == "none",
                    )
                    cursor.execute(
                        "UPDATE garmin_private_payload SET ciphertext=%s, nonce=%s, "
                        "authTag=%s, "
                        "encryptionVersion=2, keyVersion=1 WHERE id=%s",
                        (
                            envelope.ciphertext,
                            envelope.nonce,
                            envelope.auth_tag,
                            row[0],
                        ),
                    )
            verified = _validate_current(connection, new_token, new_data)
            if verified != counts:
                raise RuntimeError("post-migration row count mismatch")
            _record_phase(connection, backup_id, "complete", counts, verified)
            connection.commit()
            print(
                f"migration verified backup={backup_id} "
                f"credentials={counts[0]} payloads={counts[1]}"
            )
    except Exception:
        connection.rollback()
        if _table_exists(connection, "app_secret_encryption_migration"):
            _record_phase(connection, backup_id, "failed", counts)
            connection.commit()
        raise
    finally:
        connection.close()


def verify(backup_id: str) -> None:
    new_token, new_data = _current_keys()
    connection = _connection()
    credential_backup, payload_backup = _backup_tables(backup_id)
    try:
        with _locked(connection):
            if not all(
                _table_exists(connection, table)
                for table in (credential_backup, payload_backup)
            ):
                raise RuntimeError("named backup is incomplete or missing")
            current = _validate_current(connection, new_token, new_data)
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM `{credential_backup}`")
                old_credentials = int(cursor.fetchone()[0])
                cursor.execute(f"SELECT COUNT(*) FROM `{payload_backup}`")
                old_payloads = int(cursor.fetchone()[0])
            if current != (old_credentials, old_payloads):
                raise RuntimeError("backup and current row counts differ")
            print(
                f"verification ok backup={backup_id} "
                f"credentials={current[0]} payloads={current[1]}"
            )
    finally:
        connection.close()


def rollback(backup_id: str, *, dry_run: bool = False) -> None:
    old_token, old_data = _legacy_keys()
    connection = _connection()
    credential_backup, payload_backup = _backup_tables(backup_id)
    try:
        with _locked(connection):
            if not all(
                _table_exists(connection, table)
                for table in (credential_backup, payload_backup)
            ):
                raise RuntimeError("named backup is incomplete or missing")
            # Authenticate every backup row before replacing any live data.
            expected = _validate_legacy(
                connection,
                old_token,
                old_data,
                credential_table=credential_backup,
                payload_table=payload_backup,
            )
            if dry_run:
                print(
                    f"rollback dry-run ok backup={backup_id} "
                    f"credentials={expected[0]} payloads={expected[1]}"
                )
                return
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM garmin_credential")
                cursor.execute(
                    f"INSERT INTO garmin_credential SELECT * FROM `{credential_backup}`"
                )
                cursor.execute("DELETE FROM garmin_private_payload")
                cursor.execute(
                    "INSERT INTO garmin_private_payload "
                    f"SELECT * FROM `{payload_backup}`"
                )
            counts = _validate_legacy(connection, old_token, old_data)
            if counts != expected:
                raise RuntimeError("rollback row count mismatch")
            if _table_exists(connection, "app_secret_encryption_migration"):
                _record_phase(connection, backup_id, "rolled_back", expected, counts)
            connection.commit()
            print(
                f"rollback verified backup={backup_id} "
                f"credentials={counts[0]} payloads={counts[1]}"
            )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="manage-encryption")
    environment = parser.add_mutually_exclusive_group(required=True)
    environment.add_argument("--env-file", type=Path)
    environment.add_argument("--env-dir", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)
    preflight_parser = subparsers.add_parser("preflight")
    preflight_parser.add_argument("--dry-run", action="store_true")
    migrate_parser = subparsers.add_parser("migrate")
    migrate_parser.add_argument("--backup-id", required=True)
    migrate_parser.add_argument("--dry-run", action="store_true")
    for name in ("verify", "rollback"):
        command = subparsers.add_parser(name)
        command.add_argument("--backup-id", required=True)
        if name == "rollback":
            command.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.env_file is not None:
            load_environment(args.env_file)
        else:
            load_environment_directory(args.env_dir)
        if args.command == "preflight":
            preflight(dry_run=args.dry_run)
        elif args.command == "migrate":
            migrate(args.backup_id, dry_run=args.dry_run)
        elif args.command == "verify":
            verify(args.backup_id)
        else:
            rollback(args.backup_id, dry_run=args.dry_run)
    except Exception as error:
        print(f"manage-encryption failed: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
