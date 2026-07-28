"""AES-256-GCM token envelopes."""

import base64
import os
from dataclasses import dataclass

AAD = b"applog:garmin-token:v1"


@dataclass(frozen=True, slots=True)
class EncryptedToken:
    """Database representation of an authenticated token envelope."""

    ciphertext: bytes
    nonce: bytes
    auth_tag: bytes
    version: int = 1


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
    encrypted = AESGCM(key).encrypt(nonce, token_json.encode(), AAD)
    return EncryptedToken(encrypted[:-16], nonce, encrypted[-16:])


def decrypt_token(envelope: EncryptedToken, key: bytes) -> str:
    """Authenticate and decrypt a version-one Garmin token envelope."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if envelope.version != 1:
        raise ValueError("unsupported Garmin token encryption version")
    plaintext = AESGCM(key).decrypt(
        envelope.nonce, envelope.ciphertext + envelope.auth_tag, AAD
    )
    return plaintext.decode()
