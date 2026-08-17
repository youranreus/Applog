# Comment Email Notification Cross-Layer Contract

> Canonical contract for the H mail token, administrator configuration UI, comment lifecycle triggers, recipients, templates, retries, and privacy-safe delivery.

## 1. Scope / Trigger

Use this guide whenever changing:

- `SYSTEM_NOTIFICATION_CONFIG`, its shared type/constants/helpers, or generic system-config access;
- `NotificationModule`, H client requests, retry/batch behavior, or notification logs;
- comment creation/moderation notification calls;
- the Dashboard notification settings component/API;
- `docs/notification-templates/**` or template variable names.

This is a common/backend/frontend/external-service boundary. The mail token and recipient data are secrets/PII; masking and logging rules are security boundaries.

## 2. Signatures

### Persistent and shared config

```ts
interface INotificationConfig {
  mailToken: string
  enabled: boolean
}

const SYSTEM_CONFIG_KEYS = {
  NOTIFICATION_CONFIG: 'NOTIFICATION_CONFIG',
} as const

const NOTIFICATION_MAIL_TOKEN_MASK = '********'
```

The full database key is `SYSTEM_NOTIFICATION_CONFIG` after the configured system prefix is applied. `SystemConfigEntity.configValue` stores the normalized JSON, including plaintext `mailToken`; API responses never return that plaintext.

Shared helpers are the only owners of normalization, masking, and preserve detection:

```ts
normalizeNotificationConfig(value): INotificationConfig
maskNotificationMailToken(value): INotificationConfig
shouldKeepExistingNotificationMailToken(value): boolean
```

### Administrator API

| Method | Path | Input | Output |
|---|---|---|---|
| `GET` | `/notification/config` | admin JWT | masked `INotificationConfig` |
| `PUT` | `/notification/config` | `{ mailToken: string, enabled: boolean }` | masked saved config |

The controller uses `version: [VERSION_NEUTRAL, '1']` and both handlers require `@AuthRoles('admin')`.

### H create request

```ts
type HRecipient =
  | { kind: 'user'; userId: number }
  | { kind: 'email'; email: string }

interface HTemplateNotificationRequest {
  recipients: HRecipient[]
  content: {
    kind: 'template'
    templateKey: 'applog-comment-status' | 'applog-new-comment'
    variables: Record<string, string>
  }
  idempotencyKey: string
}
```

Send `POST <H_BASE_URL>/v1/notifications` with `Authorization: NotificationKey <mailToken>`. `H_BASE_URL` is backend-owned and defaults to `https://sf.imouto.tech`; it is not an admin form field.

## 3. Contracts

### Secret config

- Only the dedicated raw server method may return the plaintext token.
- Dedicated admin reads and generic admin reads must mask a non-empty token as `********`.
- Empty string or `********` on save preserves the existing token; a different trimmed value replaces it.
- Disabling preserves the token. Enabling without an existing or newly supplied token is rejected.
- Generic `setConfig` must reject this secret key so a mask cannot overwrite the token.
- Non-admin generic/specialized reads and writes are rejected before the generic `SYSTEM_` read rule.
- Disabled, missing, or malformed config causes a no-send result and never fails comment creation/moderation.

### Triggers and recipients

- After a non-admin successfully creates any post/page root comment or nested reply, notify all administrators with valid positive `ssoId` values. Administrator-originated comments produce no new-comment notification.
- Notify a commenter only when persisted moderation status actually changes: `pending -> approved/rejected` and `approved <-> rejected`. Re-saving the current status sends nothing.
- Guest status recipient: `{ kind: 'email', email: guestEmail }`.
- Authenticated status recipient: `{ kind: 'user', userId: author.ssoId }`. Missing/non-positive `ssoId` is skipped with no email fallback.
- Deduplicate/sort administrator `ssoId` values and split into deterministic batches of at most 20.
- Failure of one administrator batch must be contained; every later batch is still attempted.

### Templates and variables

`applog-comment-status` variables:

```text
commenterName targetTitle targetType statusLabel commentExcerpt viewUrl
```

`applog-new-comment` variables:

```text
siteName targetTitle targetType commenterName commentExcerpt adminUrl
```

Comment excerpts collapse whitespace, strip tag-shaped markup, remain plain text, and cap at 160 Unicode code points. Template variables and logs never contain email, IP, User-Agent, token, withdrawal capability, or raw HTML.

Repository HTML under `docs/notification-templates/` is the versioned source and is published to H manually. Backend variables and HTML placeholders must stay exact; no template-management sync API exists in AppLog.

### Consistency, idempotency, and retries

- Persist the comment/status first. Notification failures never roll back or alter the comment API result.
- New-comment idempotency starts with `applog-new-comment-<commentId>`; status events include comment id, target status, and persisted update timestamp so later repeated transitions remain distinct.
- Add deterministic `-b<index>` per recipient batch and reuse the same full key and payload on retry.
- Use two total attempts. Retry transport failures, `429`, and `503` only; other HTTP/schema errors are not retryable.
- H create success means queued, not delivered. AppLog does not poll status or guarantee eventual delivery in this contract.
- `NotificationService` is a required `CommentService` dependency. Do not make it optional or optional-chain calls; module-wiring regressions must fail tests/startup rather than silently lose notification behavior.

### Frontend

- `SystemSettings.vue` only composes `NotificationSettings` for administrators.
- `NotificationSettings.vue` owns the focused form and uses `<script setup lang="ts">`, typed Alova API methods, `useRequest`, existing Field/Input/Switch/Button primitives, and `layoutStore.notify`.
- Keep the token draft separate from the masked response object. Use `type="password"` and `autocomplete="new-password"`; clear the draft after successful load/save.

## 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| non-admin reads/writes notification config | reject without returning config/token |
| generic admin reads notification key | return masked JSON |
| generic set attempts notification key | reject; never store mask as token |
| save empty/mask with existing token | preserve token |
| enable without any token | reject save |
| disabled/missing config | skip H call; comment succeeds |
| malformed config/database read failure | privacy-safe log; contain failure; comment succeeds |
| authenticated author has no valid `ssoId` | skip; warn by comment/count only; no email fallback |
| administrator has no valid `ssoId` | omit recipient; aggregate warning without identity |
| no actual status transition | do not clear/change/send again |
| one admin batch fails | log/contain that batch and continue later batches |
| H transport/429/503 | retry once with identical body/idempotency key |
| other H 4xx or invalid success schema | do not retry; contain after logging metadata only |
| H accepted notification | log event/comment/batch/attempt/notification ID only |

Never log or return authorization headers, mail tokens, recipient identifiers/addresses, request bodies, template variables, or comment text.

## 5. Good / Base / Bad Cases

### Good

1. An admin saves a new token and enables notifications; the response contains `********`.
2. A guest submits a pending page reply. Valid administrators are notified in sorted batches; a failed first batch does not block the second.
3. Approval persists, then the guest receives a status-template request by email. A transient `503` retry uses the identical idempotency key.

### Base

- Notifications are disabled. Comment creation and moderation behave exactly as before and make no H request.
- An authenticated commenter has `ssoId`; status notification uses H `kind: user` and never sends their email.

### Bad

- Returning plaintext token from `GET /notification/config` or generic `GET /config/:key`.
- Falling back to account email when an authenticated author's `ssoId` is missing.
- Optional-chaining an optionally injected notification service.
- Throwing an H failure after the comment has persisted.
- Aborting the administrator batch loop on its first failed request.
- Logging an Axios error/request body, recipient, token, or template variables.

## 6. Tests Required

Common/config tests:

- normalization trims token and normalizes enabled;
- masking returns `********` only for a non-empty token;
- empty/mask means preserve, other value means replace;
- dedicated and generic admin reads remain masked;
- non-admin access and generic writes are rejected;
- enabling without a token fails; disabling preserves it.

Backend notification tests:

- exact H header/path/payload and valid success schema;
- identical idempotency body across transport/429/503 retry; no retry for other 4xx/schema failure;
- deterministic dedupe/sort/20-recipient batching and continuation after partial batch failure;
- disabled/missing config makes no client call;
- article/page and root/reply targets produce correct variables/URLs;
- admin self-comment skip, missing administrator/author `ssoId` skip, and no authenticated-email fallback;
- only real status transitions notify and persistence succeeds when notification fails;
- logs/assertions prove token, email, recipient IDs, and comment body are absent.

Frontend/template tests:

- typed API uses the dedicated admin endpoints;
- settings composition is admin-only, draft remains separate, password/autocomplete/mask/preserve UX is present;
- both HTML templates contain every declared variable and no undeclared placeholders;
- common/backend/frontend lint, type-check/build, unit suites, and `git diff --check` pass.

## 7. Wrong vs Correct

```ts
// Wrong: token can leak and the mask can overwrite it through generic config.
return JSON.parse(entity.configValue)

// Correct: specialized and generic reads share the mask boundary.
return maskNotificationMailToken(normalizeNotificationConfig(parsed))
```

```ts
// Wrong: one rejected batch prevents remaining administrators from being attempted.
for (const batch of batches) await client.send(token, batch)

// Correct: contain each batch independently while keeping deterministic order.
for (const batch of batches) {
  try {
    await client.send(token, batch.payload, batch.trace)
  } catch (error) {
    logPrivacySafeBatchFailure(batch, error)
  }
}
```

```ts
// Wrong: module wiring regressions silently disable the feature.
this.notificationService?.notifyNewComment(saved)

// Correct: required DI plus contained runtime delivery failure.
await this.notificationService.notifyNewComment(saved)
```
