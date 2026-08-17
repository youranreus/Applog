# H notification API evidence

Source: <https://sf.imouto.tech/third-party-notification-integration-guide.html>, read 2026-08-17.

## Confirmed contract

- Server-side create endpoint: `POST /v1/notifications` with `Authorization: NotificationKey <value>` and JSON content.
- Successful create returns a notification ID and means accepted/queued, not delivered.
- Recipients are either `{ kind: "user", userId: positiveInteger }` or `{ kind: "email", email }`.
- Manual email recipients require an H application policy grant. After resolution/deduplication, one request can address at most 20 email recipients.
- Template content sends `templateKey` plus declared string variables; template access and enabled state are policy-controlled.
- `idempotencyKey` is optional, 1–191 characters, and must be reused for retries. The same key with changed recipients/content returns a conflict.
- Retry candidates are rate limiting (`429`) and unavailable email channel (`503`); the guide recommends bounded jittered exponential backoff.
- Statuses are `pending`, `processing`, `sent`, `partial_failed`, and `failed`; only the last three are terminal.
- Secrets, authorization headers, recipients, and message bodies must not be logged.

## Planning implications

- AppLog will use two controlled templates and store their HTML source in the repository, but template publication remains manual because the public integration guide exposes no template-management API.
- The newly issued H mail token will be stored in AppLog's administrator-only `SYSTEM_NOTIFICATION_CONFIG`, masked on every client read, and supplied as the documented Notification Key authorization value.
- AppLog will not interpret create success as final delivery and will not add polling in this MVP.
- Admin recipients need deterministic batches of at most 20.
- Guest status notification requires the H application to allow manual email recipients.

## Unavailable detail

The public integration guide does not specify the H admin template editor's escaped-variable placeholder syntax. The repository template README must call out verification of the current H-supported syntax during manual publication; backend variable names remain fixed by the typed contract.
