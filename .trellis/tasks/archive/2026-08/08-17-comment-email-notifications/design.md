# 博客评论邮件通知技术设计

## 1. Architecture and boundaries

Add a backend-only `NotificationModule` under `packages/backend/src/module/notification/`. It owns the H HTTP contract, configuration API facade, retry classification, idempotency forwarding, privacy-safe logging, recipient batching, and the two typed comment-notification operations. `CommentService` remains the owner of comment lifecycle rules and calls this module only after persistence succeeds. `SystemConfigService` owns persistence, access control, masking, and preserve-on-blank semantics for the mail token.

No frontend API or database schema is added. Repository-owned template sources live under `docs/notification-templates/` and are manually published to H.

```text
CommentService.create / approve
  -> persist comment or status first
  -> build immutable notification event context
  -> NotificationService
       -> resolve/dedupe/batch H recipients (max 20)
       -> POST H /v1/notifications with stable idempotency key
       -> bounded retry for network/429/503 only
       -> privacy-safe warning/error; never fail comment operation
```

## 2. Configuration and secret lifecycle

Add a shared cross-layer contract in `@applog/common`:

```ts
interface INotificationConfig {
  mailToken: string
  enabled: boolean
}
```

Add `SYSTEM_NOTIFICATION_CONFIG`, `NOTIFICATION_MAIL_TOKEN_MASK = '********'`, masking, normalization, and preserve-on-empty-or-mask helpers to `@applog/common`.

`SystemConfigService` stores the full JSON value in `SystemConfigEntity`. It treats this key as an administrator-only secret key before the generic `SYSTEM_` read rule, blocks generic `setConfig`, masks generic administrator reads, and exposes dedicated raw/masked/save methods. `mailToken` remains plaintext in the database to support outbound authentication, matching existing Umami/Duolingo credential handling; it is never returned to a client.

`NotificationController` exposes administrator-only `GET /notification/config` and `PUT /notification/config`. Empty or mask preserves an existing token. Disabling preserves the token. Enabling without an existing or newly submitted token is rejected so the UI cannot display a misleading enabled state.

The outbound client reads the raw database config at event time so changes take effect without restart. When disabled, missing, or malformed, it skips before sending. H's base URL remains server-owned (`H_BASE_URL` optional override, default `https://sf.imouto.tech`); it is not exposed in the administrator form. The database `mailToken` is sent as `Authorization: NotificationKey <mailToken>`.

Template keys are code constants, not environment configuration:

- `applog-comment-status`
- `applog-new-comment`

## 3. H API contract

Create request:

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

The client accepts `{ code: 0, msg: 'success', data: { notificationId } }` on a successful HTTP response. It does not poll delivery state because H acceptance means queued, not delivered, and status polling is out of scope.

Retry at most two total attempts, with a short jittered backoff and a per-attempt timeout that fits the serverless request budget. Retry only transport failures, `429`, and `503`; do not retry other 4xx responses. Every retry reuses exactly the same request body and idempotency key.

H limits a request to 20 resolved email recipients. Admin recipients are positive, non-null `ssoId` values, deduplicated and split into deterministic groups of 20 sorted by `ssoId`. Each group uses `<event-key>-b<zero-based-index>` so batches cannot collide.

## 4. Recipient and trigger rules

### New comment

After `CommentEntity` is saved and hydrated:

1. If the submitting JWT role is admin, stop without notification.
2. Query all local users with role `admin`, selecting `ssoId`.
3. Skip null/non-positive `ssoId` values with an aggregate warning that contains counts only.
4. Notify all remaining administrators for both post and page targets, for root comments and nested replies, regardless of the newly created comment's moderation status.

Idempotency event key: `applog-new-comment-<commentId>` plus batch suffix.

### Comment status

Before save, retain the previous status. If it equals the requested status, return the current admin DTO without clearing capability state again and without notification. Otherwise save first, then choose the recipient:

- guest comment: `{ kind: 'email', email: guestEmail }`;
- authenticated comment: load the author relation including `ssoId`; use `{ kind: 'user', userId: ssoId }`;
- authenticated author with null/non-positive `ssoId`: skip and warn without email fallback or PII.

Idempotency event key includes comment id, persisted target status, and the persisted `updatedAt` event timestamp so a later repeated transition such as rejected -> approved -> rejected remains a distinct event while retries remain stable.

## 5. Context and links

Load the target relation needed for title and slug. Use `FRONT_URL` as the trusted origin:

- post public URL: `/archives/<encoded-slug>.html`;
- page public URL: `/<encoded-slug>.html`;
- approved status notification appends `#comment-<id>`; rejected status notification links to the target without a hidden-comment anchor;
- admin URL: `/user/comment`.

Read site name from `SYSTEM_BASE_CONFIG.title`; fall back to `Applog` when absent or invalid.

Normalize comment content to a single-line plain-text summary, collapse whitespace, and cap it at 160 Unicode code points with an ellipsis. Never include guest email, account email, IP, agent, token, or raw HTML in template variables or logs.

Template variables:

| Template | Variables |
|---|---|
| `applog-comment-status` | `commenterName`, `targetTitle`, `targetType`, `statusLabel`, `commentExcerpt`, `viewUrl` |
| `applog-new-comment` | `siteName`, `targetTitle`, `targetType`, `commenterName`, `commentExcerpt`, `adminUrl` |

`targetType` and `statusLabel` are presentation strings produced by the backend (`文章` / `页面`, `已通过` / `已拒绝`) so templates remain simple.

## 6. Repository template artifacts

Create:

- `docs/notification-templates/README.md`: template keys, exact variable tables, suggested subject/plain-text forms, manual H publication checklist, and the requirement to verify H's currently supported placeholder syntax in its admin UI.
- `docs/notification-templates/applog-comment-status.html`
- `docs/notification-templates/applog-new-comment.html`

HTML must be email-safe, responsive, readable without remote images, and interpolate only the declared variables. Before production enablement, manually paste/publish both templates and run one test event of each type. No sync script or template-management API call is added.

## 7. Failure and consistency semantics

Comment persistence is the primary transaction. Notification is awaited after persistence to give the serverless runtime a chance to finish, but all notification errors are contained at the notification boundary. A failed notification never rolls back or changes the comment API response.

Logs may include event kind, comment id, batch index, attempt, HTTP status/error class, and returned notification id. They must not include recipient identifiers, addresses, authorization headers, request bodies, template variables, or comment text.

Missing/disabled configuration is a normal no-send outcome, not a comment failure. Invalid stored JSON or a database read failure is logged without token/config contents and contained at the notification boundary.

## 8. Frontend component map

- `SystemSettings.vue`: existing composition surface; renders `NotificationSettings` only for administrators and owns no notification form state.
- `NotificationSettings.vue`: focused form component responsible for loading masked config, keeping the token draft separate from server state, deriving the placeholder, saving, inline error display, and success/error toast feedback.
- `src/api/notification/index.ts`: typed Alova methods for `GET/PUT /notification/config` using `INotificationConfig` from `@applog/common`.

The form uses Vue 3 `<script setup lang="ts">`, minimal source state, computed `enabled`/placeholder values, `useRequest` for load/save, `type="password"`, `autocomplete="new-password"`, and existing `Field`, `Input`, `Switch`, and `Button` components. The token draft is cleared after every successful load/save. `layoutStore.notify` remains the only toast path.

## 9. Compatibility, rollout, and rollback

- Existing comments, API payloads, and database rows remain unchanged.
- Logged-in users lacking `ssoId` receive no status mail; identity repair is explicitly deferred.
- After deployment, an administrator pastes the newly issued mail token into System Settings and enables notifications. H must also allow manual-email recipients for guest status mail, grant both templates to the AppLog application, and receive the repository HTML through the manual publication flow.
- Rollback is configuration-first: turn off `enabled` in System Settings or revoke the H token/template policy. Code rollback needs no schema migration; the extra system-config row is inert and may remain.

## 10. Important trade-offs

- No outbox means a notification can be lost after bounded retries; accepted for this MVP.
- Awaiting bounded delivery attempts adds latency to create/moderate requests; strict timeouts and two attempts bound it.
- Template source and H runtime template can drift because publishing is manual; the README checklist and contract tests reduce but cannot eliminate this operational risk.
- The mail token is plaintext at rest in the existing system-config table, consistent with current third-party credentials but dependent on database access controls and backups being protected.
