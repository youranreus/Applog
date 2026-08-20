import base64
import json
from pathlib import Path

import pytest

from garmin_sync.secret_encryption import decode_master_key, derive_key, envelope_aad

VECTORS = json.loads(
    (
        Path(__file__).parents[3] / "docs/security/secret-encryption-vectors.json"
    ).read_text()
)


def test_derivation_matches_shared_vectors():
    master = base64.b64decode(VECTORS["masterKeyBase64"])
    for purpose, expected in VECTORS["derivedKeysBase64"].items():
        assert base64.b64encode(derive_key(master, purpose)).decode() == expected


def test_purposes_and_record_aad_are_isolated():
    master = bytes(range(32))
    assert derive_key(master, "garmin.credential") != derive_key(
        master, "garmin.private-payload"
    )
    assert envelope_aad("flomo.token", "one") != envelope_aad("flomo.token", "two")
    with pytest.raises(ValueError):
        derive_key(master, "caller-controlled")


def test_master_key_is_strict_base64_32_bytes():
    expected = bytes(range(32))
    assert decode_master_key(base64.b64encode(expected).decode()) == expected
    for value in (
        "not-base64!",
        base64.b64encode(b"short").decode(),
        base64.b64encode(expected).decode()[:-1] + "B",
    ):
        with pytest.raises(ValueError):
            decode_master_key(value)
