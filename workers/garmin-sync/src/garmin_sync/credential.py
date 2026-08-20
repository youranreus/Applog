"""AES-256-GCM token envelopes."""

import base64
import os
from dataclasses import dataclass

LEGACY_AAD = b"applog:garmin-token:v1"


@dataclass(frozen=True, slots=True)
class EncryptedToken:
    """Database representation of an authenticated token envelope."""

    ciphertext: bytes
    nonce: bytes
    auth_tag: bytes
    version: int = 2
    key_version: int = 1


def decode_key(encoded_key: str) -> bytes:
    """Decode a base64-encoded 256-bit encryption key."""
    try:
        key = base64.b64decode(encoded_key, validate=True)
    except ValueError as error:
        raise ValueError("GARMIN_TOKEN_ENCRYPTION_KEY must be valid base64") from error
    if len(key) != 32:
        raise ValueError("GARMIN_TOKEN_ENCRYPTION_KEY must decode to 32 bytes")
    return key


def encrypt_token(token_json: str, key: bytes) -> EncryptedToken:
    """Encrypt serialized Garmin tokens with a random 96-bit nonce."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = os.urandom(12)
    from .secret_encryption import envelope_aad

    encrypted = AESGCM(key).encrypt(
        nonce, token_json.encode(), envelope_aad("garmin.credential", "1")
    )
    return EncryptedToken(encrypted[:-16], nonce, encrypted[-16:])


def decrypt_token(envelope: EncryptedToken, key: bytes) -> str:
    """Authenticate and decrypt a version-one Garmin token envelope."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    from .secret_encryption import ENVELOPE_VERSION, KEY_VERSION, envelope_aad

    if envelope.version != ENVELOPE_VERSION or envelope.key_version != KEY_VERSION:
        raise ValueError("unsupported Garmin token encryption version")
    plaintext = AESGCM(key).decrypt(
        envelope.nonce,
        envelope.ciphertext + envelope.auth_tag,
        envelope_aad("garmin.credential", "1"),
    )
    return plaintext.decode()


def decrypt_legacy_token(envelope: EncryptedToken, key: bytes) -> str:
    """Decrypt a legacy v1 token; maintenance tooling is the only caller."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if envelope.version != 1:
        raise ValueError("unsupported legacy Garmin token encryption version")
    plaintext = AESGCM(key).decrypt(
        envelope.nonce, envelope.ciphertext + envelope.auth_tag, LEGACY_AAD
    )
    return plaintext.decode()
