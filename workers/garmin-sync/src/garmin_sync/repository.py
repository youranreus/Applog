"""Direct MySQL persistence shared with the NestJS read model."""

import os
from datetime import UTC, datetime
from typing import Any

from .credential import EncryptedToken, decrypt_token, encrypt_token
from .models import ActivitySnapshot

LOCK_NAME = "applog_garmin_sync"


def _mysql_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


class MySQLRepository:
    """Transactional snapshot and encrypted credential storage."""

    def __init__(self, connection: Any, encryption_key: bytes) -> None:
        self._connection = connection
        self._encryption_key = encryption_key

    @classmethod
    def from_environment(cls, encryption_key: bytes) -> "MySQLRepository":
        """Build a repository from the same MYSQL_* settings as NestJS."""
        import pymysql

        connection = pymysql.connect(
            host=os.environ["MYSQL_SERVER"],
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.environ["MYSQL_USER"],
            password=os.environ["MYSQL_PASSWORD"],
            database=os.environ["MYSQL_DATABASE"],
            charset="utf8mb4",
            autocommit=True,
        )
        return cls(connection, encryption_key)

    def acquire_lease(self) -> bool:
        """Acquire a connection-scoped non-blocking singleton lease."""
        with self._connection.cursor() as cursor:
            cursor.execute("SELECT GET_LOCK(%s, 0)", (LOCK_NAME,))
            row = cursor.fetchone()
            return bool(row and row[0] == 1)

    def release_lease(self) -> None:
        with self._connection.cursor() as cursor:
            cursor.execute("SELECT RELEASE_LOCK(%s)", (LOCK_NAME,))

    def close(self) -> None:
        self._connection.close()

    def load_token(self) -> str:
        """Decrypt the singleton token record without exposing it to logs."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT ciphertext, nonce, authTag, encryptionVersion "
                "FROM garmin_credential WHERE id = 1"
            )
            row = cursor.fetchone()
        if not row:
            raise RuntimeError("garmin_credential_missing")
        return decrypt_token(
            EncryptedToken(bytes(row[0]), bytes(row[1]), bytes(row[2]), int(row[3])),
            self._encryption_key,
        )

    def store_credential(self, token_json: str) -> None:
        """Atomically replace the encrypted singleton credential."""
        envelope = encrypt_token(token_json, self._encryption_key)
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_credential
                  (id, ciphertext, nonce, authTag, encryptionVersion,
                   createdAt, updatedAt)
                VALUES (1, %s, %s, %s, %s, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE
                  ciphertext = VALUES(ciphertext), nonce = VALUES(nonce),
                  authTag = VALUES(authTag),
                  encryptionVersion = VALUES(encryptionVersion),
                  updatedAt = CURRENT_TIMESTAMP(3)
                """,
                (
                    envelope.ciphertext,
                    envelope.nonce,
                    envelope.auth_tag,
                    envelope.version,
                ),
            )

    def begin_attempt(self, attempted_at: datetime) -> None:
        """Record invocation start without invalidating a previous snapshot."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_sync_state
                  (id, totalActivityCount, backfillComplete, lastAttemptedAt,
                   status, createdAt, updatedAt)
                VALUES (1, 0, FALSE, %s, 'never_synced',
                        CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE
                  lastAttemptedAt = VALUES(lastAttemptedAt),
                  updatedAt = CURRENT_TIMESTAMP(3)
                """,
                (_mysql_datetime(attempted_at),),
            )

    def processed_route_ids(self) -> set[str]:
        """Return activities whose route availability has already been resolved."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT sourceActivityId FROM garmin_activity_snapshot "
                "WHERE routeProcessed = TRUE"
            )
            return {str(row[0]) for row in cursor.fetchall()}

    def commit_success(
        self,
        *,
        snapshots: list[ActivitySnapshot],
        total_count: int,
        cutoff: datetime,
        synced_at: datetime,
        token_json: str,
        backfill_cursor: str | None,
        backfill_complete: bool,
    ) -> None:
        """Publish normalized rows and advance state atomically."""
        envelope = encrypt_token(token_json, self._encryption_key)
        synced_value = _mysql_datetime(synced_at)
        cutoff_value = _mysql_datetime(cutoff)
        self._connection.begin()
        try:
            with self._connection.cursor() as cursor:
                for snapshot in snapshots:
                    cursor.execute(
                        """
                        INSERT INTO garmin_activity_snapshot
                          (sourceActivityId, activityType, activityTypeDisplay,
                           startedAt,
                           distanceMeters, durationSeconds, deviceSource, routePathData,
                           routeViewBox, routeProcessed, published,
                           sourceUpdatedAt, lastSeenAt,
                           createdAt, updatedAt)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                TRUE, %s, %s,
                                CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                        ON DUPLICATE KEY UPDATE
                          activityType = VALUES(activityType),
                          activityTypeDisplay = VALUES(activityTypeDisplay),
                          startedAt = VALUES(startedAt),
                          distanceMeters = VALUES(distanceMeters),
                          durationSeconds = VALUES(durationSeconds),
                          deviceSource = VALUES(deviceSource),
                          routePathData = COALESCE(
                            VALUES(routePathData), routePathData
                          ),
                          routeViewBox = COALESCE(VALUES(routeViewBox), routeViewBox),
                          routeProcessed = routeProcessed OR VALUES(routeProcessed),
                          published = TRUE,
                          sourceUpdatedAt = VALUES(sourceUpdatedAt),
                          lastSeenAt = VALUES(lastSeenAt),
                          updatedAt = CURRENT_TIMESTAMP(3)
                        """,
                        (
                            snapshot.source_activity_id,
                            snapshot.activity_type,
                            snapshot.activity_type_display,
                            _mysql_datetime(snapshot.started_at),
                            snapshot.distance_meters,
                            snapshot.duration_seconds,
                            snapshot.device_source,
                            snapshot.route_path_data,
                            snapshot.route_view_box,
                            snapshot.route_processed,
                            _mysql_datetime(snapshot.source_updated_at)
                            if snapshot.source_updated_at
                            else None,
                            synced_value,
                        ),
                    )
                cursor.execute(
                    "UPDATE garmin_activity_snapshot SET published = FALSE "
                    "WHERE startedAt >= %s AND lastSeenAt < %s",
                    (cutoff_value, synced_value),
                )
                cursor.execute(
                    "DELETE FROM garmin_activity_snapshot WHERE startedAt < %s",
                    (cutoff_value,),
                )
                cursor.execute(
                    """
                    INSERT INTO garmin_credential
                      (id, ciphertext, nonce, authTag, encryptionVersion,
                       createdAt, updatedAt)
                    VALUES (1, %s, %s, %s, %s,
                            CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                    ON DUPLICATE KEY UPDATE
                      ciphertext = VALUES(ciphertext), nonce = VALUES(nonce),
                      authTag = VALUES(authTag),
                      encryptionVersion = VALUES(encryptionVersion),
                      updatedAt = CURRENT_TIMESTAMP(3)
                    """,
                    (
                        envelope.ciphertext,
                        envelope.nonce,
                        envelope.auth_tag,
                        envelope.version,
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO garmin_sync_state
                      (id, totalActivityCount, backfillCursor, backfillComplete,
                       lastAttemptedAt, lastSuccessfulAt, status, errorCategory,
                       createdAt, updatedAt)
                    VALUES (1, %s, %s, %s, %s, %s, 'healthy', NULL,
                            CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                    ON DUPLICATE KEY UPDATE
                      totalActivityCount = VALUES(totalActivityCount),
                      backfillCursor = VALUES(backfillCursor),
                      backfillComplete = VALUES(backfillComplete),
                      lastAttemptedAt = VALUES(lastAttemptedAt),
                      lastSuccessfulAt = VALUES(lastSuccessfulAt),
                      status = 'healthy', errorCategory = NULL,
                      updatedAt = CURRENT_TIMESTAMP(3)
                    """,
                    (
                        total_count,
                        backfill_cursor,
                        backfill_complete,
                        synced_value,
                        synced_value,
                    ),
                )
            self._connection.commit()
        except Exception:
            self._connection.rollback()
            raise

    def mark_failure(self, attempted_at: datetime, category: str) -> None:
        """Record a non-sensitive failure category and preserve old snapshots."""
        status = "reauth_required" if category == "authentication" else "degraded"
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_sync_state
                  (id, totalActivityCount, backfillComplete, lastAttemptedAt,
                   status, errorCategory, createdAt, updatedAt)
                VALUES (1, 0, FALSE, %s, %s, %s,
                        CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE
                  lastAttemptedAt = VALUES(lastAttemptedAt),
                  status = VALUES(status), errorCategory = VALUES(errorCategory),
                  updatedAt = CURRENT_TIMESTAMP(3)
                """,
                (_mysql_datetime(attempted_at), status, category[:64]),
            )
