"""Narrow read-only boundary around python-garminconnect."""

import time
from collections.abc import Callable
from typing import Any, TypeVar

from .normalize import extract_detail_points, extract_gpx_points

T = TypeVar("T")


class GarminReadAdapter:
    """Expose only the Garmin reads needed by the sync domain."""

    def __init__(self, token_json: str, *, is_cn: bool) -> None:
        from garminconnect import Garmin

        self._api = Garmin(is_cn=is_cn, retry_attempts=1)
        self._api.client.loads(token_json)

    def _call(self, operation: Callable[[], T]) -> T:
        from garminconnect import GarminConnectTooManyRequestsError

        try:
            return operation()
        except GarminConnectTooManyRequestsError:
            time.sleep(1.5)
            return operation()

    def count_activities(self) -> int:
        """Return the all-history account activity count."""
        return self._call(self._api.count_activities)

    def get_activities_by_date(self, start: str, end: str) -> list[dict[str, Any]]:
        """Return activities for the rolling persistence window."""
        result = self._call(lambda: self._api.get_activities_by_date(start, end))
        return result if isinstance(result, list) else []

    def get_route_points(self, activity_id: str) -> list[tuple[float, float]]:
        """Read detail polyline, falling back to an in-memory GPX download."""
        from garminconnect import Garmin, GarminConnectAuthenticationError

        try:
            details = self._call(
                lambda: self._api.get_activity_details(activity_id, maxpoly=4000)
            )
            points = extract_detail_points(details)
            if points:
                return points
        except GarminConnectAuthenticationError:
            raise
        except Exception:
            pass
        try:
            gpx = self._call(
                lambda: self._api.download_activity(
                    activity_id, dl_fmt=Garmin.ActivityDownloadFormat.GPX
                )
            )
            return extract_gpx_points(gpx)
        except GarminConnectAuthenticationError:
            raise
        except Exception:
            return []

    def dump_tokens(self) -> str:
        """Serialize possibly refreshed tokens for encrypted persistence."""
        return self._api.client.dumps()
