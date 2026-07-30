import sys
import types
from unittest.mock import patch

from garmin_sync.adapter import GarminReadAdapter


class FakeRateLimitError(Exception):
    pass


def test_token_restore_uses_library_login_to_initialize_profile() -> None:
    calls: list[tuple[str, object]] = []
    token_json = '{"token":"' + "x" * 600 + '"}'

    class FakeClient:
        def dumps(self) -> str:
            return '{"refreshed":true}'

    class FakeGarmin:
        def __init__(self, *, is_cn: bool, retry_attempts: int) -> None:
            calls.append(("init", (is_cn, retry_attempts)))
            self.client = FakeClient()

        def login(self, tokenstore: str) -> None:
            calls.append(("login", tokenstore))

    module = types.ModuleType("garminconnect")
    module.Garmin = FakeGarmin
    module.GarminConnectTooManyRequestsError = FakeRateLimitError
    with patch.dict(sys.modules, {"garminconnect": module}):
        adapter = GarminReadAdapter(token_json, is_cn=True)

    assert calls == [
        ("init", (True, 1)),
        ("login", token_json),
    ]
    assert adapter.dump_tokens() == '{"refreshed":true}'
