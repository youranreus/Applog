"""Direct MySQL persistence shared with the NestJS read model."""

import json
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from .cover import ActivityCover
from .credential import EncryptedToken, decrypt_token, encrypt_token
from .models import (
    ActivitySnapshot,
    NormalizedActivityDetail,
    NormalizedHealthDaily,
    PrivateActivity,
)
from .payload_codec import encrypt_payload

LOCK_NAME = "applog_garmin_sync"


def _mysql_datetime(value: datetime) -> datetime:
    """Normalize to UTC-naive MySQL DATETIME(3) precision."""
    if value.tzinfo is not None:
        value = value.astimezone(UTC).replace(tzinfo=None)
    return value.replace(microsecond=value.microsecond // 1000 * 1000)


def _mysql_local_datetime(value: datetime) -> datetime:
    """Preserve a Garmin local wall-clock boundary without UTC conversion."""
    return value.replace(tzinfo=None, microsecond=value.microsecond // 1000 * 1000)


class MySQLRepository:
    """Transactional snapshot and encrypted credential storage."""

    def __init__(
        self,
        connection: Any,
        encryption_key: bytes,
        data_encryption_key: bytes | None = None,
    ) -> None:
        self._connection = connection
        self._encryption_key = encryption_key
        self._data_encryption_key = data_encryption_key

    @classmethod
    def from_environment(
        cls, encryption_key: bytes, data_encryption_key: bytes | None = None
    ) -> "MySQLRepository":
        """Build a repository from the Garmin-specific MySQL settings."""
        import pymysql

        connection = pymysql.connect(
            host=os.getenv("GARMIN_MYSQL_SERVER") or os.environ["MYSQL_SERVER"],
            port=int(os.getenv("GARMIN_MYSQL_PORT") or os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("GARMIN_MYSQL_USER") or os.environ["MYSQL_USER"],
            password=os.getenv("GARMIN_MYSQL_PASSWORD")
            or os.environ["MYSQL_PASSWORD"],
            database=os.getenv("GARMIN_MYSQL_DATABASE")
            or os.environ["MYSQL_DATABASE"],
            charset="utf8mb4",
            autocommit=True,
        )
        return cls(connection, encryption_key, data_encryption_key)

    def get_stream_cursor(self, stream_key: str) -> tuple[str | None, bool]:
        """Return a resumable stream cursor and completion marker."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT `cursor`, backfillComplete FROM garmin_sync_stream_state "
                "WHERE streamKey = %s",
                (stream_key,),
            )
            row = cursor.fetchone()
        return (
            str(row[0]) if row and row[0] is not None else None,
            bool(row[1]) if row else False,
        )

    def advance_stream(
        self,
        stream_key: str,
        cursor_value: str | None,
        *,
        complete: bool,
        succeeded_at: datetime,
    ) -> None:
        """Advance one stream only after its data transaction succeeds."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_sync_stream_state
                  (streamKey, `cursor`, backfillComplete, lastAttemptedAt,
                   lastSuccessfulAt, status, consecutiveFailureCount, updatedAt)
                VALUES (%s, %s, %s, %s, %s, 'healthy', 0, CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE `cursor` = VALUES(`cursor`),
                  backfillComplete = VALUES(backfillComplete),
                  lastAttemptedAt = VALUES(lastAttemptedAt),
                  lastSuccessfulAt = VALUES(lastSuccessfulAt), status = 'healthy',
                  errorCategory = NULL, consecutiveFailureCount = 0,
                  updatedAt = CURRENT_TIMESTAMP(3)
                """,
                (
                    stream_key,
                    cursor_value,
                    complete,
                    _mysql_datetime(succeeded_at),
                    _mysql_datetime(succeeded_at),
                ),
            )

    def upsert_private_activity(
        self, activity: PrivateActivity, *, seen_at: datetime
    ) -> int:
        """Idempotently index an activity regardless of visibility."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_private_activity
                  (sourceActivityId, activityUuid, activityType, privacyType,
                   startedAtGmt, startedAtLocal, sourceUpdatedAt, lastSeenAt,
                   reconciliationStatus, detailStatus, createdAt, updatedAt)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', 'pending',
                        CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE activityUuid = VALUES(activityUuid),
                  activityType = VALUES(activityType),
                  privacyType = VALUES(privacyType),
                  startedAtGmt = VALUES(startedAtGmt),
                  startedAtLocal = VALUES(startedAtLocal),
                  sourceUpdatedAt = VALUES(sourceUpdatedAt),
                  lastSeenAt = VALUES(lastSeenAt), reconciliationStatus = 'active',
                  updatedAt = CURRENT_TIMESTAMP(3), id = LAST_INSERT_ID(id)
                """,
                (
                    activity.source_activity_id,
                    activity.activity_uuid,
                    activity.activity_type,
                    activity.privacy_type,
                    _mysql_datetime(activity.started_at_gmt)
                    if activity.started_at_gmt
                    else None,
                    _mysql_datetime(activity.started_at_local)
                    if activity.started_at_local
                    else None,
                    _mysql_datetime(activity.source_updated_at)
                    if activity.source_updated_at
                    else None,
                    _mysql_datetime(seen_at),
                ),
            )
            private_id = int(cursor.lastrowid)
            if activity.privacy_type not in {"public", "everyone"}:
                cursor.execute(
                    "UPDATE garmin_activity_snapshot SET published = FALSE, "
                    "updatedAt = CURRENT_TIMESTAMP(3) WHERE sourceActivityId = %s",
                    (activity.source_activity_id,),
                )
            return private_id

    def store_private_payload(
        self,
        *,
        domain: str,
        owner_key: str,
        payload_kind: str,
        value: Any,
        fetched_at: datetime,
        binary: bool = False,
    ) -> bool:
        """Encrypt and upsert only when source content changed."""
        if self._data_encryption_key is None:
            raise ValueError(
                "GARMIN_DATA_ENCRYPTION_KEY is required for private archive"
            )
        envelope = encrypt_payload(
            value,
            self._data_encryption_key,
            domain=domain,
            owner_key=owner_key,
            payload_kind=payload_kind,
            binary=binary,
        )
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT contentHash FROM garmin_private_payload "
                "WHERE domain = %s AND ownerKey = %s AND payloadKind = %s",
                (domain, owner_key, payload_kind),
            )
            existing = cursor.fetchone()
            if existing and existing[0] == envelope.content_hash:
                return False
            cursor.execute(
                """
                INSERT INTO garmin_private_payload
                  (domain, ownerKey, payloadKind, contentType, compression,
                   ciphertext, nonce, authTag, encryptionVersion, contentHash,
                   fetchedAt, createdAt, updatedAt)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE contentType = VALUES(contentType),
                  compression = VALUES(compression), ciphertext = VALUES(ciphertext),
                  nonce = VALUES(nonce), authTag = VALUES(authTag),
                  encryptionVersion = VALUES(encryptionVersion),
                  contentHash = VALUES(contentHash), fetchedAt = VALUES(fetchedAt),
                  updatedAt = CURRENT_TIMESTAMP(3)
                """,
                (
                    domain,
                    owner_key,
                    payload_kind,
                    envelope.content_type,
                    envelope.compression,
                    envelope.ciphertext,
                    envelope.nonce,
                    envelope.auth_tag,
                    envelope.version,
                    envelope.content_hash,
                    _mysql_datetime(fetched_at),
                ),
            )
        return True

    def activity_needs_detail(self, private_activity_id: int) -> bool:
        """Return whether an activity has never completed a detail attempt."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT detailStatus FROM garmin_private_activity WHERE id = %s",
                (private_activity_id,),
            )
            row = cursor.fetchone()
        return bool(row and row[0] in {"pending", "failed"})

    def mark_activity_detail_pending(self, private_activity_id: int) -> None:
        """Queue a changed activity for a fresh bounded detail read."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "UPDATE garmin_private_activity SET detailStatus = 'pending', "
                "updatedAt = CURRENT_TIMESTAMP(3) WHERE id = %s",
                (private_activity_id,),
            )

    def pending_activity_details(self, limit: int) -> list[tuple[int, str]]:
        """Return the newest not-yet-attempted activity details."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, sourceActivityId FROM garmin_private_activity "
                "WHERE detailStatus IN ('pending', 'failed') "
                "ORDER BY startedAtGmt DESC, id DESC LIMIT %s",
                (limit,),
            )
            rows = cursor.fetchall()
        return [(int(row[0]), str(row[1])) for row in rows]

    def covered_activity_ids(
        self, render_version: str, preferred_provider: str | None
    ) -> set[str]:
        """Return source IDs whose route covers match the active renderer."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT activity.sourceActivityId "
                "FROM garmin_activity_cover cover "
                "INNER JOIN garmin_private_activity activity "
                "ON activity.id = cover.privateActivityId "
                "WHERE cover.renderVersion = %s "
                "AND (%s IS NULL OR cover.provider = %s)",
                (render_version, preferred_provider, preferred_provider),
            )
            return {str(row[0]) for row in cursor.fetchall()}

    def upsert_activity_detail(
        self,
        private_activity_id: int,
        detail: NormalizedActivityDetail,
        *,
        status: str,
    ) -> None:
        """Persist queryable detail and endpoint-completeness state."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_activity_detail
                  (privateActivityId, movingDurationSeconds,
                   averageSpeedMetersPerSecond, maxSpeedMetersPerSecond,
                   averageHeartRateBpm, maxHeartRateBpm, elevationGainMeters,
                   averageCadencePerMinute, averagePowerWatts, trainingEffect,
                   bodyBatteryDelta, lapCount, splitData)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  movingDurationSeconds = VALUES(movingDurationSeconds),
                  averageSpeedMetersPerSecond = VALUES(averageSpeedMetersPerSecond),
                  maxSpeedMetersPerSecond = VALUES(maxSpeedMetersPerSecond),
                  averageHeartRateBpm = VALUES(averageHeartRateBpm),
                  maxHeartRateBpm = VALUES(maxHeartRateBpm),
                  elevationGainMeters = VALUES(elevationGainMeters),
                  averageCadencePerMinute = VALUES(averageCadencePerMinute),
                  averagePowerWatts = VALUES(averagePowerWatts),
                  trainingEffect = VALUES(trainingEffect),
                  bodyBatteryDelta = VALUES(bodyBatteryDelta),
                  lapCount = VALUES(lapCount), splitData = VALUES(splitData)
                """,
                (
                    private_activity_id,
                    detail.moving_duration_seconds,
                    detail.average_speed_meters_per_second,
                    detail.max_speed_meters_per_second,
                    detail.average_heart_rate_bpm,
                    detail.max_heart_rate_bpm,
                    detail.elevation_gain_meters,
                    detail.average_cadence_per_minute,
                    detail.average_power_watts,
                    detail.training_effect,
                    detail.body_battery_delta,
                    detail.lap_count,
                    json.dumps(detail.splits or [], separators=(",", ":")),
                ),
            )
            cursor.execute(
                "UPDATE garmin_private_activity SET detailStatus = %s, "
                "updatedAt = CURRENT_TIMESTAMP(3) WHERE id = %s",
                (status, private_activity_id),
            )

    def upsert_health_day(
        self,
        calendar_date: str,
        health: NormalizedHealthDaily,
        domain_status: dict[str, str],
    ) -> None:
        """Record independent domain availability without conflating zero and null."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO garmin_health_daily
                  (calendarDate, localBoundaryStart, gmtBoundaryStart,
                   summaryData, domainStatus, updatedAt)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP(3))
                ON DUPLICATE KEY UPDATE
                  localBoundaryStart = VALUES(localBoundaryStart),
                  gmtBoundaryStart = VALUES(gmtBoundaryStart),
                  summaryData = VALUES(summaryData),
                  domainStatus = VALUES(domainStatus), updatedAt = CURRENT_TIMESTAMP(3)
                """,
                (
                    calendar_date,
                    _mysql_local_datetime(health.local_boundary_start)
                    if health.local_boundary_start
                    else None,
                    _mysql_datetime(health.gmt_boundary_start)
                    if health.gmt_boundary_start
                    else None,
                    json.dumps(health.summary_data, separators=(",", ":")),
                    json.dumps(domain_status, separators=(",", ":")),
                ),
            )

    def store_activity_cover(
        self, source_activity_id: str, cover: ActivityCover, *, generated_at: datetime
    ) -> str | None:
        """Store immutable cover bytes, rotating the public ID when content changes."""
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM garmin_private_activity WHERE sourceActivityId = %s",
                (source_activity_id,),
            )
            private_row = cursor.fetchone()
            if not private_row:
                return None
            private_id = int(private_row[0])
            cursor.execute(
                "SELECT coverId, provider, etag, renderVersion "
                "FROM garmin_activity_cover "
                "WHERE privateActivityId = %s LIMIT 1",
                (private_id,),
            )
            existing = cursor.fetchone()
            if existing:
                existing_cover_id = str(existing[0])
                existing_provider = str(existing[1])
                provider_rank = {"local": 0, "local-route": 1}
                existing_rank = provider_rank.get(existing_provider, 2)
                new_rank = provider_rank.get(cover.provider, 2)
                if new_rank < existing_rank:
                    return existing_cover_id
                if str(existing[2]) == cover.etag:
                    if (
                        existing_provider != cover.provider
                        or str(existing[3]) != cover.render_version
                    ):
                        cursor.execute(
                            "UPDATE garmin_activity_cover SET provider = %s, "
                            "attribution = %s, renderVersion = %s, generatedAt = %s "
                            "WHERE privateActivityId = %s",
                            (
                                cover.provider,
                                cover.attribution,
                                cover.render_version,
                                _mysql_datetime(generated_at),
                                private_id,
                            ),
                        )
                    return existing_cover_id

            cover_id = str(uuid.uuid4())
            self._connection.begin()
            try:
                if existing:
                    cursor.execute(
                        """
                        UPDATE garmin_activity_cover SET coverId = %s,
                          imageData = %s, width = %s, height = %s, byteSize = %s,
                          etag = %s, provider = %s, attribution = %s,
                          renderVersion = %s, generatedAt = %s
                        WHERE privateActivityId = %s
                        """,
                        (
                            cover_id,
                            cover.image_data,
                            cover.width,
                            cover.height,
                            len(cover.image_data),
                            cover.etag,
                            cover.provider,
                            cover.attribution,
                            cover.render_version,
                            _mysql_datetime(generated_at),
                            private_id,
                        ),
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO garmin_activity_cover
                          (coverId, privateActivityId, imageData, contentType,
                           width, height, byteSize, etag, provider, attribution,
                           renderVersion, generatedAt)
                        VALUES (%s, %s, %s, 'image/webp', %s, %s, %s, %s, %s,
                                %s, %s, %s)
                        """,
                        (
                            cover_id,
                            private_id,
                            cover.image_data,
                            cover.width,
                            cover.height,
                            len(cover.image_data),
                            cover.etag,
                            cover.provider,
                            cover.attribution,
                            cover.render_version,
                            _mysql_datetime(generated_at),
                        ),
                    )
                cursor.execute(
                    "UPDATE garmin_activity_snapshot SET coverId = %s, "
                    "updatedAt = CURRENT_TIMESTAMP(3) WHERE sourceActivityId = %s",
                    (cover_id, source_activity_id),
                )
                self._connection.commit()
                return cover_id
            except Exception:
                self._connection.rollback()
                raise

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
                    if snapshot.public_id is None:
                        snapshot.public_id = str(uuid.uuid4())
                    cursor.execute(
                        """
                        INSERT INTO garmin_activity_snapshot
                          (sourceActivityId, publicId, activityType,
                           activityTypeDisplay,
                           startedAt,
                           distanceMeters, durationSeconds, calories, locationName,
                           deviceSource, routePathData,
                           routeViewBox, routeProcessed, detailData, coverId, published,
                           sourceUpdatedAt, lastSeenAt,
                           createdAt, updatedAt)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s, %s, TRUE, %s, %s,
                                CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
                        ON DUPLICATE KEY UPDATE
                          activityType = VALUES(activityType),
                          activityTypeDisplay = VALUES(activityTypeDisplay),
                          startedAt = VALUES(startedAt),
                          distanceMeters = VALUES(distanceMeters),
                          durationSeconds = VALUES(durationSeconds),
                          calories = VALUES(calories),
                          locationName = VALUES(locationName),
                          deviceSource = VALUES(deviceSource),
                          routePathData = COALESCE(
                            VALUES(routePathData), routePathData
                          ),
                          routeViewBox = COALESCE(VALUES(routeViewBox), routeViewBox),
                          routeProcessed = routeProcessed OR VALUES(routeProcessed),
                          publicId = COALESCE(publicId, VALUES(publicId)),
                          detailData = COALESCE(VALUES(detailData), detailData),
                          coverId = COALESCE(VALUES(coverId), coverId),
                          published = TRUE,
                          sourceUpdatedAt = VALUES(sourceUpdatedAt),
                          lastSeenAt = VALUES(lastSeenAt),
                          updatedAt = CURRENT_TIMESTAMP(3)
                        """,
                        (
                            snapshot.source_activity_id,
                            snapshot.public_id,
                            snapshot.activity_type,
                            snapshot.activity_type_display,
                            _mysql_datetime(snapshot.started_at),
                            snapshot.distance_meters,
                            snapshot.duration_seconds,
                            snapshot.calories,
                            snapshot.location_name,
                            snapshot.device_source,
                            snapshot.route_path_data,
                            snapshot.route_view_box,
                            snapshot.route_processed,
                            json.dumps(snapshot.detail_data, separators=(",", ":"))
                            if snapshot.detail_data is not None
                            else None,
                            snapshot.cover_id,
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
