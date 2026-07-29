import dataclasses

import pytest
from cryptography.exceptions import InvalidTag

from garmin_sync.payload_codec import decrypt_payload, encrypt_payload

KEY = bytes(range(32))


def test_canonical_json_hash_is_stable_and_round_trips():
    first = encrypt_payload(
        {"b": 2, "a": [1, 0]},
        KEY,
        domain="activity",
        owner_key="synthetic-owner",
        payload_kind="summary",
    )
    second = encrypt_payload(
        {"a": [1, 0], "b": 2},
        KEY,
        domain="activity",
        owner_key="synthetic-owner",
        payload_kind="summary",
    )

    assert first.content_hash == second.content_hash
    assert first.ciphertext != second.ciphertext
    assert decrypt_payload(
        first,
        KEY,
        domain="activity",
        owner_key="synthetic-owner",
        payload_kind="summary",
    ) == {"a": [1, 0], "b": 2}


def test_tampering_wrong_key_and_wrong_aad_are_rejected():
    envelope = encrypt_payload(
        {"safe": True},
        KEY,
        domain="health",
        owner_key="synthetic-date",
        payload_kind="sleep",
    )
    tampered = dataclasses.replace(
        envelope,
        ciphertext=bytes([envelope.ciphertext[0] ^ 1]) + envelope.ciphertext[1:],
    )
    for candidate_key, owner_key, candidate in [
        (KEY, "synthetic-date", tampered),
        (b"x" * 32, "synthetic-date", envelope),
        (KEY, "different-owner", envelope),
    ]:
        with pytest.raises(InvalidTag):
            decrypt_payload(
                candidate,
                candidate_key,
                domain="health",
                owner_key=owner_key,
                payload_kind="sleep",
            )


def test_fit_binary_round_trip_and_size_guard():
    fit = b".FIT-synthetic-binary\x00\x01"
    envelope = encrypt_payload(
        fit,
        KEY,
        domain="activity",
        owner_key="synthetic-owner",
        payload_kind="fit",
        binary=True,
    )
    assert envelope.compression == "none"
    assert decrypt_payload(
        envelope,
        KEY,
        domain="activity",
        owner_key="synthetic-owner",
        payload_kind="fit",
    ) == fit
    with pytest.raises(ValueError, match="hash mismatch"):
        decrypt_payload(
            dataclasses.replace(envelope, content_hash="0" * 64),
            KEY,
            domain="activity",
            owner_key="synthetic-owner",
            payload_kind="fit",
        )
    with pytest.raises(ValueError, match="too_large"):
        encrypt_payload(
            fit,
            KEY,
            domain="activity",
            owner_key="synthetic-owner",
            payload_kind="fit",
            binary=True,
            max_bytes=1,
        )
