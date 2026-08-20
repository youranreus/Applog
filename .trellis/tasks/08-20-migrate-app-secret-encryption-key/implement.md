# Implementation plan

## 1. Freeze the cryptographic contract

- Add a language-neutral HKDF/AAD/envelope contract and deterministic test
  vectors for the three reserved purposes.
- Add Python and TypeScript tests proving identical derived bytes, purpose
  isolation, record-bound AAD, random nonces, wrong-key failure, and malformed
  master-key rejection.
- Keep `OIDC_SESSION_SECRET`, `TOKEN_SECRET`, and password hashing untouched.

## 2. Add reusable runtime primitives

- Add a server-only NestJS secret-encryption module/service for strict master-key
  decoding, purpose allowlisting, HKDF-SHA256 derivation, and AES-256-GCM v2
  envelopes.
- Refactor the Garmin worker codecs around a shared Python derivation/envelope
  boundary while preserving explicit legacy-v1 decryptors for migration only.
- Update Garmin entities/repository mappings to carry `keyVersion` separately
  from `encryptionVersion`.
- Ensure normal worker paths write/read only the v2 application-key format after
  activation and fail closed on legacy or unknown versions.

## 3. Build the one-time migration automation

- Add the repository-owned `manage-encryption` command with `preflight`,
  `migrate`, `verify`, and `rollback`, including `--dry-run` where applicable.
- Validate environment, schema, scheduler/process state, advisory lock, legacy
  readability, target versions, backup id, and target row inventory before
  mutation.
- Create and verify immutable backup tables plus a non-secret migration ledger.
- Re-encrypt credentials and private payloads in bounded transactions using
  fresh nonces, immediate plaintext round-trip comparison, and payload hash
  verification.
- Make resume version-aware and refuse activation for mixed/incomplete state.
- Implement verified rollback from the named backup and leave backup retirement
  as a separate explicit operation.
- Extend the existing timer/deployment automation so the maintenance window is
  one command with preflight, apply, verify, and actionable retry/rollback output.

## 4. Update configuration and operations

- Add `APP_SECRET_ENCRYPTION_KEY` to the backend and Garmin worker deployment
  environments without changing `OIDC_SESSION_SECRET`.
- Remove legacy Garmin key requirements from the post-migration runtime, while
  allowing the maintenance command to receive them during the transition.
- Update Garmin and deployment documentation with key generation, exact release
  order, dry-run, maintenance invocation, verification, rollback, backup
  retention, and legacy-key retirement.
- Update relevant Trellis specs after the implementation establishes the final
  executable contract.

## 5. Validation gates

Run at minimum:

```text
pnpm --filter @applog/backend test:unit
pnpm --filter @applog/backend build
cd workers/garmin-sync && pytest
cd workers/garmin-sync && ruff check .
```

Add focused integration tests for:

- legacy fixture database to dry-run with zero mutations;
- successful full migration and new-key-only reads;
- interruption followed by resume;
- wrong old/new key and tampered ciphertext;
- mixed/unknown version refusal;
- backup-count/digest mismatch refusal;
- rollback restoring legacy readability;
- missing-input preflight with no secret leakage;
- timer remains disabled after failure;
- second invocation is idempotent.

Before activation, exercise the command against a disposable MySQL database with
representative JSON, FIT, credential, deleted/edge-case, and same-owner payloads.

## Risk and rollback points

- Do not run production migration before staging validates TypeORM schema sync.
- Do not enable the worker while a migration ledger is incomplete.
- Do not delete old keys or backup tables in the migration command.
- Any verification failure exits non-zero and points to the named rollback
  command; rollback must complete before the old worker is re-enabled.
- Preserve unrelated user work already present in the dirty worktree.

## Review gates before `task.py start`

- User approves the final PRD/design/implementation summary.
- Both context manifests validate with real entries.
- The implementation agent receives the Garmin, database, deployment, quality,
  and code-reuse contracts.
