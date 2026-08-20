# Persistent secret-encryption contract

`APP_SECRET_ENCRYPTION_KEY` is a canonical Base64 encoding of exactly 32 random
bytes. It is an application master key, not a password. `OIDC_SESSION_SECRET`,
JWT signing keys, and password hashes remain separate security domains.

For each allowlisted purpose, derive a 32-byte key with HKDF-SHA256:

```text
IKM  = strict_base64_decode(APP_SECRET_ENCRYPTION_KEY)
salt = UTF8("applog:secret-encryption:v1")
info = UTF8("applog:" + purpose + ":key:v1")
L    = 32
```

The immutable version-1 purposes are `garmin.credential`,
`garmin.private-payload`, and the reserved `flomo.token`. Callers cannot supply
arbitrary purposes.

Persistent version-2 envelopes use AES-256-GCM, a fresh random 12-byte nonce,
a 16-byte authentication tag, and key version 1. The canonical UTF-8 AAD is:

```json
["applog-secret","<purpose>","<record identity>",2,1]
```

The record identity must be stable and unique within its purpose. Garmin uses
credential id `1`, or `domain:ownerKey:payloadKind` for its allowlisted payload
domains. Moving ciphertext across purposes or records must fail authentication.

Database rows store ciphertext, nonce, authentication tag, envelope version,
and key version, but never the master or derived keys. Existing envelope-v1 rows
have key version 0 and are readable only by the maintenance migration command.
Steady-state runtimes accept only envelope 2/key 1.

The checked-in [test vectors](./secret-encryption-vectors.json) are non-secret.
Both TypeScript and Python tests must match them whenever this contract changes.
Changing a purpose, salt, info, AAD shape, or version requires an explicit data
migration; these protocol strings must not be casually renamed.
