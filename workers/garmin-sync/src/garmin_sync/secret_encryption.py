"""Application-wide secret key derivation and envelope metadata."""

import base64
import json

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

MASTER_KEY_ENV = "APP_SECRET_ENCRYPTION_KEY"
HKDF_SALT = b"applog:secret-encryption:v1"
ENVELOPE_VERSION = 2
KEY_VERSION = 1
PURPOSES = frozenset({"garmin.credential", "garmin.private-payload", "flomo.token"})


def decode_master_key(encoded_key: str) -> bytes:
    """Strictly decode the Base64-encoded 256-bit application master key."""
    try:
        key = base64.b64decode(encoded_key, validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError(f"{MASTER_KEY_ENV} must be valid base64") from error
    if len(key) != 32 or base64.b64encode(key).decode() != encoded_key:
        raise ValueError(f"{MASTER_KEY_ENV} must decode to 32 bytes")
    return key


def derive_key(master_key: bytes, purpose: str) -> bytes:
    """Derive a purpose-isolated AES-256 key using the shared HKDF contract."""
    if len(master_key) != 32:
        raise ValueError("application master key must be 32 bytes")
    if purpose not in PURPOSES:
        raise ValueError("unsupported secret-encryption purpose")
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=HKDF_SALT,
        info=f"applog:{purpose}:key:v1".encode(),
    ).derive(master_key)


def envelope_aad(purpose: str, record_identity: str) -> bytes:
    """Return canonical record-bound AAD for a v2/key-v1 envelope."""
    if purpose not in PURPOSES:
        raise ValueError("unsupported secret-encryption purpose")
    return json.dumps(
        ["applog-secret", purpose, record_identity, ENVELOPE_VERSION, KEY_VERSION],
        ensure_ascii=True,
        separators=(",", ":"),
    ).encode()
