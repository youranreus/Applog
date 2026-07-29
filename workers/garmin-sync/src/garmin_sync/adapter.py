"""Narrow read-only boundary around python-garminconnect."""

import os
import time
from collections.abc import Callable
from typing import Any, TypeVar

from .normalize import extract_detail_points, extract_gpx_points

T = TypeVar("T")


class GarminRequestBudgetExhausted(RuntimeError):
    """Raised before an upstream call would exceed the invocation budget."""


class GarminReadAdapter:
    """Expose only the Garmin reads needed by the sync domain."""

    def __init__(self, token_json: str, *, is_cn: bool) -> None:
        from garminconnect import Garmin

        self._api = Garmin(is_cn=is_cn, retry_attempts=1)
        self._api.client.loads(token_json)
        self._remaining_requests = max(
            1, int(os.getenv("GARMIN_REQUEST_BUDGET", "80"))
        )

    def _call(self, operation: Callable[[], T]) -> T:
        from garminconnect import GarminConnectTooManyRequestsError

        def invoke() -> T:
            if self._remaining_requests <= 0:
                raise GarminRequestBudgetExhausted(
                    "garmin_request_budget_exhausted"
                )
            self._remaining_requests -= 1
            return operation()

        try:
            return invoke()
        except GarminConnectTooManyRequestsError:
            time.sleep(1.5)
            return invoke()

    def count_activities(self) -> int:
        """Return the all-history account activity count."""
        return self._call(self._api.count_activities)

    def get_activities_page(self, start: int, limit: int) -> list[dict[str, Any]]:
        """Return an all-type activity page for resumable history backfill."""
        result = self._call(lambda: self._api.get_activities(start, limit))
        return result if isinstance(result, list) else []

    def get_activity_payloads(self, activity_id: str) -> dict[str, Any]:
        """Read each available activity domain independently.

        Authentication and rate-limit failures remain fatal. Conditional endpoint
        failures are represented by omission so callers can persist partial data.
        """
        from garminconnect import (
            Garmin,
            GarminConnectAuthenticationError,
            GarminConnectTooManyRequestsError,
        )

        reads: dict[str, Callable[[], Any]] = {
            "summary": lambda: self._api.get_activity(activity_id),
            "details": lambda: self._api.get_activity_details(activity_id),
            "splits": lambda: self._api.get_activity_splits(activity_id),
            "typed_splits": lambda: self._api.get_activity_typed_splits(activity_id),
            "split_summaries": lambda: self._api.get_activity_split_summaries(
                activity_id
            ),
            "weather": lambda: self._api.get_activity_weather(activity_id),
            "hr_zones": lambda: self._api.get_activity_hr_in_timezones(activity_id),
            "power_zones": lambda: self._api.get_activity_power_in_timezones(
                activity_id
            ),
            "gear": lambda: self._api.get_activity_gear(activity_id),
            "fit": lambda: self._api.download_activity(
                activity_id, dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL
            ),
        }
        payloads: dict[str, Any] = {}
        for kind, read in reads.items():
            try:
                payloads[kind] = self._call(read)
            except (
                GarminConnectAuthenticationError,
                GarminConnectTooManyRequestsError,
                GarminRequestBudgetExhausted,
            ):
                raise
            except Exception:
                continue
        return payloads

    def get_health_payloads(
        self, calendar_date: str
    ) -> tuple[dict[str, Any], set[str]]:
        """Read daily health domains independently using Garmin's local date."""
        from garminconnect import (
            GarminConnectAuthenticationError,
            GarminConnectTooManyRequestsError,
        )

        reads: dict[str, Callable[[], Any]] = {
            "body_battery": lambda: self._api.get_body_battery(
                calendar_date, calendar_date
            ),
            "body_battery_events": lambda: self._api.get_body_battery_events(
                calendar_date
            ),
            "stress": lambda: self._api.get_stress_data(calendar_date),
            "heart_rate": lambda: self._api.get_heart_rates(calendar_date),
            "resting_heart_rate": lambda: self._api.get_rhr_day(calendar_date),
            "steps": lambda: self._api.get_steps_data(calendar_date),
            "sleep": lambda: self._api.get_sleep_data(calendar_date),
            "hrv": lambda: self._api.get_hrv_data(calendar_date),
            "spo2": lambda: self._api.get_spo2_data(calendar_date),
            "respiration": lambda: self._api.get_respiration_data(calendar_date),
            "hydration": lambda: self._api.get_hydration_data(calendar_date),
            "intensity_minutes": lambda: self._api.get_intensity_minutes_data(
                calendar_date
            ),
            "body_composition": lambda: self._api.get_body_composition(
                calendar_date, calendar_date
            ),
        }
        payloads: dict[str, Any] = {}
        failed_domains: set[str] = set()
        for domain, read in reads.items():
            try:
                payloads[domain] = self._call(read)
            except (
                GarminConnectAuthenticationError,
                GarminConnectTooManyRequestsError,
                GarminRequestBudgetExhausted,
            ):
                raise
            except Exception:
                failed_domains.add(domain)
        return payloads, failed_domains

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
