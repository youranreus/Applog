"""Authenticated encryption for private Garmin JSON and FIT payloads."""

import gzip
import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any, Literal

ENCRYPTION_VERSION = 1
DEFAULT_MAX_PAYLOAD_BYTES = 32 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class EncryptedPayload:
    """Storage-ready AES-256-GCM envelope and deterministic source hash."""

    ciphertext: bytes
    nonce: bytes
    auth_tag: bytes
    content_hash: str
    content_type: str
    compression: Literal["gzip", "none"]
    version: int = ENCRYPTION_VERSION


def _aad(domain: str, owner_key: str, payload_kind: str, version: int) -> bytes:
    return json.dumps(
        ["applog-garmin", domain, owner_key, payload_kind, version],
        ensure_ascii=True,
        separators=(",", ":"),
    ).encode()


def canonical_json(value: Any) -> bytes:
    """Serialize source JSON deterministically and reject non-JSON numbers."""
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()


def encrypt_payload(
    value: Any,
    key: bytes,
    *,
    domain: str,
    owner_key: str,
    payload_kind: str,
    binary: bool = False,
    max_bytes: int = DEFAULT_MAX_PAYLOAD_BYTES,
) -> EncryptedPayload:
    """Compress and encrypt one payload with row-identity-bound AAD."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if len(key) != 32:
        raise ValueError("GARMIN_DATA_ENCRYPTION_KEY must decode to 32 bytes")
    raw = bytes(value) if binary and isinstance(value, bytes | bytearray) else None
    if binary and raw is None:
        raise TypeError("binary payload must be bytes")
    if raw is None:
        raw = canonical_json(value)
    if len(raw) > max_bytes:
        raise ValueError("garmin_payload_too_large")
    content_hash = hashlib.sha256(raw).hexdigest()
    compression: Literal["gzip", "none"] = "none" if binary else "gzip"
    plaintext = raw if binary else gzip.compress(raw, mtime=0)
    nonce = os.urandom(12)
    encrypted = AESGCM(key).encrypt(
        nonce,
        plaintext,
        _aad(domain, owner_key, payload_kind, ENCRYPTION_VERSION),
    )
    return EncryptedPayload(
        ciphertext=encrypted[:-16],
        nonce=nonce,
        auth_tag=encrypted[-16:],
        content_hash=content_hash,
        content_type="application/octet-stream" if binary else "application/json",
        compression=compression,
    )


def decrypt_payload(
    envelope: EncryptedPayload,
    key: bytes,
    *,
    domain: str,
    owner_key: str,
    payload_kind: str,
) -> bytes | Any:
    """Authenticate, decrypt and decode an archived payload."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if envelope.version != ENCRYPTION_VERSION:
        raise ValueError("unsupported Garmin data encryption version")
    plaintext = AESGCM(key).decrypt(
        envelope.nonce,
        envelope.ciphertext + envelope.auth_tag,
        _aad(domain, owner_key, payload_kind, envelope.version),
    )
    if envelope.compression == "none":
        if hashlib.sha256(plaintext).hexdigest() != envelope.content_hash:
            raise ValueError("garmin payload hash mismatch")
        return plaintext
    if envelope.compression != "gzip":
        raise ValueError("unsupported Garmin payload compression")
    raw = gzip.decompress(plaintext)
    if hashlib.sha256(raw).hexdigest() != envelope.content_hash:
        raise ValueError("garmin payload hash mismatch")
    return json.loads(raw)
