# 评论被回复邮件通知实施计划

## Ordered checklist

1. Add the `applog-comment-reply` constant and typed template allowance.
2. Implement `NotificationService.notifyCommentReply` using the direct parent, existing config/target/excerpt/send boundaries, parent recipient mapping, normalized self-reply suppression, public reply anchor, and stable reply-id idempotency.
3. Wire authenticated/admin approved creation and real moderation-to-approved transitions after persistence; do not call for pending/rejected/top-level/no-op paths.
4. Add the versioned reply HTML template and update the repository template README/manual H publication contract.
5. Add focused service/lifecycle/template tests, including recipient privacy, missing `ssoId`, all defined self-reply modes, direct parent only, failure containment, and reapproval idempotency.
6. Run backend tests/lint/build, frontend template tests/lint/type-check/build, root build when available, and `git diff --check`.

## Risk and rollback points

- `CommentService.create` and `approve`: notifications must remain post-persistence and contained; no duplicate call on status no-op.
- `NotificationService`: do not expose parent/replier identity in logs/variables, notify ancestors, or fall back from authenticated parent to email.
- Stable idempotency key must not include a changing timestamp, otherwise reapproval can duplicate mail.
- Template variables in backend, README, HTML, and contract tests must remain exact.

No schema/data migration is required. Rollback is code/template-policy removal only.

## Validation commands

```bash
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
pnpm build
git diff --check
```
