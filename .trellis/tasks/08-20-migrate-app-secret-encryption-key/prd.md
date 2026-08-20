# Migrate encryption keys to application master key

## Goal

Replace per-feature persistent-data encryption keys with one application-level
master key while preserving cryptographic separation between secret domains and
without making existing encrypted Garmin data unreadable.

## Background

- Persistent Garmin credentials currently use `GARMIN_TOKEN_ENCRYPTION_KEY`.
- Private Garmin JSON/FIT archives currently use `GARMIN_DATA_ENCRYPTION_KEY`.
- Both stores use AES-256-GCM envelopes with random nonces and authenticated
  metadata; existing rows must remain readable throughout migration.
- `OIDC_SESSION_SECRET` also derives an AES-256-GCM key, but protects only
  short-lived login state and is not currently a persistent-data encryption key.
- `OIDC_SESSION_SECRET` remains an independent authentication secret by product
  decision; it is not derived from the application encryption master key.
- Future encrypted configuration, beginning with the Flomo token, must not
  require a new environment variable for every secret type.

## Requirements

- Introduce one Base64-encoded 32-byte application master key exposed as
  `APP_SECRET_ENCRYPTION_KEY`.
- Derive a distinct 32-byte subkey for every secret domain using a documented,
  deterministic HKDF-SHA256 contract that is identical in TypeScript and Python.
- Allocate stable purpose identifiers for Garmin credentials, Garmin private
  archives, and future Flomo credentials.
- Preserve AES-256-GCM, random 96-bit nonces, and domain/record-bound AAD.
- Distinguish envelope-format version from master-key version so key rotation
  does not overload the existing `encryptionVersion` meaning.
- Support a safe transition in which existing Garmin ciphertext remains
  readable until it has been re-encrypted with the derived key.
- Perform the historical Garmin ciphertext migration as a one-time maintenance
  operation: stop Garmin writes, complete preflight and backup, re-encrypt the
  full target set, verify it, and only then activate the new-key-only runtime.
- The maintenance migration must be transactional where practical and expose a
  repository-owned, idempotent command with preflight, dry-run, verification,
  and rollback behavior; an interrupted or failed run must not leave a mixed
  state that the normal runtime cannot read.
- Never log or persist the master key, derived keys, or decrypted secrets.
- Keep the encryption primitive behind a reusable service/codec boundary rather
  than embedding new crypto code in each feature.
- Update deployment configuration, operational documentation, and automated
  tests for both the NestJS backend and Python Garmin worker.
- The Flomo integration itself is not implemented by this task; it will consume
  the resulting generic secret-encryption contract in the dependent task.

## Acceptance Criteria

- [ ] A single `APP_SECRET_ENCRYPTION_KEY` can derive different keys for two
  different purpose identifiers, with cross-purpose decryption rejected.
- [ ] TypeScript and Python produce compatible derived keys from the same test
  vector and purpose identifier.
- [ ] Existing Garmin credential and private-archive ciphertext can be read
  before the maintenance migration and no data is lost during the window.
- [ ] Garmin data can be re-encrypted under the new derived keys and remains
  readable after the legacy keys are removed.
- [ ] The maintenance command refuses to mutate data when preflight or backup
  validation fails, can be safely retried, and produces an auditable count of
  migrated and verified rows.
- [ ] A failed migration restores or preserves a complete old-key-readable
  dataset and documents the single rollback command.
- [ ] Missing, malformed, or incorrect master keys fail closed with messages
  that do not reveal secret material.
- [ ] Encryption records carry enough version metadata to support future master
  key rotation.
- [ ] Relevant unit, repository, migration, and rollback tests pass.
- [ ] Deployment and recovery documentation describes rollout order, legacy-key
  retirement, backup restoration, and key rotation.

## Out of Scope

- Implementing Flomo synchronization or UI.
- Replacing the environment-provided master key with a cloud KMS.
- Encrypting unrelated application configuration merely because it is stored in
  the system-config table.
- Migrating or replacing `OIDC_SESSION_SECRET`; its authentication boundary and
  short-lived cookies remain unchanged.
