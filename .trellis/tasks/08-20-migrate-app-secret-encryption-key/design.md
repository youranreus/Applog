# Application master-key migration design

## Architecture and boundaries

The application receives one Base64-encoded 32-byte
`APP_SECRET_ENCRYPTION_KEY`. It is key material, not a password. Both the
NestJS backend and Python Garmin worker decode it strictly and derive an
independent AES-256 key for each stable purpose with HKDF-SHA256.

The derivation contract is language-neutral:

```text
IKM  = base64_decode(APP_SECRET_ENCRYPTION_KEY)
salt = UTF8("applog:secret-encryption:v1")
info = UTF8("applog:" + purpose + ":key:v1")
OKM  = HKDF-SHA256(IKM, salt, info, 32 bytes)
```

Initial purpose identifiers are immutable protocol values:

- `garmin.credential`
- `garmin.private-payload`
- `flomo.token` (reserved for the dependent task)

The backend owns a reusable server-only secret-encryption module. The Python
worker owns an equivalent codec because the two runtimes cannot share executable
code. A checked-in, non-secret JSON test-vector fixture is the cross-language
source of truth and both test suites must consume it.

`OIDC_SESSION_SECRET` remains independent. JWT signing (`TOKEN_SECRET`) and
password hashing are also separate cryptographic domains and are unchanged.

## Envelope contract

New persistent envelopes use AES-256-GCM with a random 12-byte nonce and a
16-byte authentication tag. Metadata distinguishes:

- `envelopeVersion`: serialization/AAD/algorithm contract;
- `keyVersion`: application master-key generation.

Existing `encryptionVersion=1` rows remain the legacy envelope format. New rows
use envelope version 2 and key version 1. Database entities gain a `keyVersion`
column; existing `encryptionVersion` columns retain their current meaning.

AAD is canonical UTF-8 JSON and binds the envelope to its purpose and record:

```json
["applog-secret", "<purpose>", "<record identity>", 2, 1]
```

For Garmin credentials, record identity is the singleton credential id. For
private payloads it includes the existing domain, owner key, and payload kind.
Cross-purpose or cross-record ciphertext movement therefore fails authentication.

The initial runtime accepts only fully migrated v2/key-v1 rows. Legacy-key
compatibility lives in the maintenance command, not indefinitely in production
request paths. Future rotation may add a generic versioned keyring, but this task
does not introduce per-feature key variables.

## Maintenance migration

Migration is a repository-owned Python command because the Garmin worker already
owns the encrypted tables and PyMySQL/cryptography dependencies. It supports:

```text
manage-encryption preflight [--dry-run]
manage-encryption migrate --backup-id ID [--dry-run]
manage-encryption verify --backup-id ID
manage-encryption rollback --backup-id ID
```

A root/documented wrapper owns the production sequence: disable the systemd
timer, verify no worker process is active, acquire a named MySQL advisory lock,
run preflight, create database backup tables, migrate, verify, and leave the
timer disabled until the new runtime and environment are activated and checked.
The FC timer is already disabled in the checked-in deployment definition; the
runbook still requires confirming it is disabled in the target environment.

Preflight validates all required environment values without printing them,
connectivity, supported schema versions, absence of unknown/mixed versions,
legacy decryption of every target row, new-key derivation, backup identifier,
and sufficient target readiness before mutation.

The command creates immutable backup tables for the two encrypted stores using
an explicit backup id, copies the full old envelopes, and verifies row counts and
content digests before rewriting production rows. Re-encryption may proceed in
bounded transactions to avoid one unbounded InnoDB transaction; normal workers
remain stopped and the advisory lock prevents a second migration process.

Every row is decrypted with its legacy purpose key, authenticated under its
legacy AAD, encrypted with a fresh nonce and the derived purpose key, then
immediately decrypted and compared with the original plaintext. Payload content
hashes are revalidated. A migration ledger records phase, backup id, source and
completed counts, timestamps, and terminal status without secret material.

Activation is forbidden until every production row is v2/key-v1, every row
round-trips, counts match the backup, and no failures remain. Only then may the
runtime configuration drop `GARMIN_TOKEN_ENCRYPTION_KEY` and
`GARMIN_DATA_ENCRYPTION_KEY`.

## Failure, retry, and rollback

An interrupted migration leaves the worker disabled and the complete legacy
backup tables intact. `migrate` is idempotent by envelope/key version and resumes
only after verifying the same backup id and source snapshot. It never treats a
partially migrated database as ready for runtime activation.

`rollback` restores the encrypted columns and version metadata from the named
backup inside bounded, verified operations, confirms every restored row is
legacy-key-readable, and records completion. The old worker and legacy variables
may be re-enabled only after rollback verification.

Backup tables are not removed automatically. Retirement is a separate explicit
post-observation operation after the new runtime has completed a successful
Garmin sync and restore evidence has been retained.

## Deployment compatibility

Because this repository uses TypeORM `synchronize: true`, the schema addition is
validated in staging before production. The maintenance entrypoint owns any
idempotent schema preparation required before migration; normal application
startup must not be relied on as the only migration mechanism.

The safe release order is:

1. ship migration-capable code without activating the new-key-only worker;
2. enter the maintenance window and run the one-command migration;
3. deploy/configure both runtimes with `APP_SECRET_ENCRYPTION_KEY`;
4. verify backend startup and a manual Garmin sync while timers remain disabled;
5. re-enable the intended scheduler;
6. retain old keys and backup tables for the documented observation period,
   then retire them explicitly.

## Security and observability

- Logs may contain phases, table names, row counts, versions, backup ids, and
  opaque row ids, but never keys, plaintext, ciphertext, nonces, or auth tags.
- Key decoding, purpose validation, and unsupported versions fail closed.
- Purpose identifiers are an allowlist, not caller-controlled arbitrary text.
- Dry-run performs decryption and validation but no schema/data/timer mutation.
- Success requires post-migration verification; partial success exits non-zero.

## Trade-offs

The maintenance-window approach simplifies the steady-state runtime and avoids
long-lived legacy-key fallback. It accepts operational downtime and requires a
full verified backup plus explicit scheduler control. Database backup tables use
additional storage but provide a more auditable rollback boundary than attempting
to reverse an interrupted in-place transformation from memory.
