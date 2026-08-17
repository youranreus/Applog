# 评论被回复邮件通知技术设计

## 1. Architecture and lifecycle entry points

Extend the existing `NotificationService`; do not add another module, config record, controller, frontend form, or delivery client.

Two comment lifecycle paths can make a reply public:

```text
authenticated/admin reply create -> saved as approved -> notify direct parent
guest reply create -> saved as pending -> no reply notification
guest reply moderation to approved -> save first -> notify direct parent
```

`CommentService.create` calls the reply notification after the existing new-comment notification and only when the saved reply is already `approved`. `CommentService.approve` calls it after a real transition is persisted and only when the target state is `approved`. The notification boundary contains all failures, so neither path changes its business response.

## 2. Parent lookup and identity

`NotificationService.notifyCommentReply(reply)` returns immediately when `parentId` is absent or reply status is not `approved`. Otherwise it loads exactly the direct parent by `parentId` with its `author` relation. It does not traverse ancestors.

The new reply must carry its author relation when authenticated. Existing create hydration already loads `author`; moderation loads `author`, and the notification service may defensively load the reply author when needed.

Recipient mapping:

- authenticated parent: valid positive `parent.author.ssoId` -> H `kind: user`; otherwise privacy-safe skip with no email fallback;
- guest parent: trimmed `parent.guestEmail` -> H `kind: email`;
- missing parent/recipient -> skip without exposing identity.

Self-reply suppression uses normalized identities:

1. authenticated reply + authenticated parent: same local `authorId`;
2. guest reply + guest parent: `trim().toLowerCase()` emails equal;
3. authenticated reply + guest parent: reply author's account email equals normalized parent guest email;
4. guest reply + authenticated parent cannot reliably prove identity from public input against the protected account and is not suppressed unless another rule above applies.

## 3. Template contract

Add constant `COMMENT_REPLY_TEMPLATE_KEY = 'applog-comment-reply'` and allow it through the typed `sendBatches` template union.

Variables:

| Variable | Meaning |
|---|---|
| `parentCommenterName` | direct parent author display name |
| `replierName` | new reply author display name |
| `targetTitle` | post/page title |
| `targetType` | `文章` or `页面` |
| `parentCommentExcerpt` | parent plain-text excerpt, max 160 code points |
| `replyExcerpt` | reply plain-text excerpt, max 160 code points |
| `viewUrl` | public target URL plus `#comment-<replyId>` |

Reuse the existing target resolver, commenter-name helper, excerpt sanitizer, H client, config gate, logging, retry, and batch boundary. No email or identity identifier is included in variables/logs.

Create `docs/notification-templates/applog-comment-reply.html` and extend the README with subject, variable table, text fallback, policy grant, manual publication, and validation checklist.

## 4. Idempotency and repeated moderation

Use stable event key `applog-comment-reply-<replyId>`; `sendBatches` adds `-b0`.

This same key is used whether the reply was public at creation or first became public through moderation. If a reply later cycles `approved -> rejected -> approved`, H receives the same recipient/content contract and deduplicates the repeated event. A previously failed/unaccepted event can be retried on later approval without creating a new logical notification.

Do not add a sent flag, schema migration, outbox, or status poller.

## 5. Compatibility and privacy

- Existing admin new-comment and commenter status notifications remain independent; approving a guest reply may legitimately send a status result to the reply author and a reply notification to the parent author.
- Administrator replies notify a non-self parent even though administrator-originated new-comment admin alerts remain suppressed.
- Public/API DTOs and database schema do not change.
- Logs contain event kind `comment-reply`, reply id, batch/attempt/error metadata only; never parent/replier email, SSO ID, text, variables, or token.
- Rollback removes the method/call sites/template constant and H template policy; no data rollback is needed.

## 6. Test strategy

Add/extend backend tests for both lifecycle entry points, top-level/pending/rejected skips, direct-parent-only behavior, recipient types, missing `ssoId`, all self-reply variants, stable idempotency, target links, variable privacy, failure containment, and co-existence with existing notifications. Extend the frontend template-contract test to include the third HTML file and exact variables.
