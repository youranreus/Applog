import base64
import unittest

from cryptography.exceptions import InvalidTag

from garmin_sync.credential import decode_key, decrypt_token, encrypt_token


class CredentialTests(unittest.TestCase):
    def test_round_trip_and_random_nonce(self) -> None:
        key = bytes(range(32))
        token = '{"session":"synthetic-value"}'
        first = encrypt_token(token, key)
        second = encrypt_token(token, key)
        self.assertNotEqual(first.nonce, second.nonce)
        self.assertNotIn(b"synthetic-value", first.ciphertext)
        self.assertEqual(decrypt_token(first, key), token)

    def test_wrong_key_cannot_decrypt(self) -> None:
        envelope = encrypt_token("synthetic", bytes(range(32)))
        with self.assertRaises(InvalidTag):
            decrypt_token(envelope, bytes(reversed(range(32))))

    def test_key_must_be_base64_encoded_32_bytes(self) -> None:
        key = bytes(range(32))
        self.assertEqual(decode_key(base64.b64encode(key).decode()), key)
        for value in ["not-base64!", base64.b64encode(b"short").decode()]:
            with self.assertRaises(ValueError):
                decode_key(value)


if __name__ == "__main__":
    unittest.main()
