# 博客评论邮件通知实施计划

## Ordered checklist

1. Add the `INotificationConfig` shared contract, config key, mask, and pure masking/preserve helpers in `@applog/common`, with unit coverage and barrel exports.
2. Extend `SystemConfigService` with notification secret access control, generic-route blocking/masking, raw/masked/save methods, enabled-with-token validation, and tests patterned after Duolingo secret config.
3. Add backend notification DTOs, administrator-only config controller endpoints, H client/service, module export, server-owned base URL, privacy-safe logging, deterministic batching, stable idempotency keys, timeout, and retry classification.
4. Inject `NotificationService` into `CommentService`; add `UserEntity` repository access and hydrate target/author data needed by notifications without widening public DTOs.
5. Wire post-persistence new-comment notification for post/page roots and replies, skip administrator-originated comments, and batch all valid admin `ssoId` recipients.
6. Wire actual status-transition detection and post-persistence commenter notification; use guest email or logged-in `ssoId`, skip missing IDs, and preserve comment success on every notification failure.
7. Add typed frontend notification API methods and a focused `NotificationSettings.vue` using Vue 3 Composition API, separate token draft state, masked placeholder, enable switch, Alova `useRequest`, inline errors, and `layoutStore.notify`; compose it into administrator System Settings.
8. Add the two repository HTML templates and their README contract/manual publication runbook.
9. Add deterministic backend coverage for request contracts, config disabled/missing/masked behavior, batching, idempotency, retry/no-retry behavior, PII-safe failure handling, trigger matrix, target links, summaries, no-op moderation, and persistence-success/notification-failure behavior.
10. Add deterministic frontend/config contract coverage for masking, blank-preserve requests, administrator-only composition, and template variables.
11. Run the full quality gate and inspect the final diff for secrets, PII logging, unintended schema/API exposure, and template/contract drift.

## Validation commands

```bash
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/common run build
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
pnpm build
git diff --check
```

Also run focused notification/comment test files during implementation before the full suite.

## Risky files and rollback points

- `packages/backend/src/module/comment/comment.service.ts`: persistence must complete before notification; existing public privacy and moderation-capability rules must remain intact.
- `packages/backend/src/module/comment/comment.module.ts`: repository/module wiring can create dependency errors; keep notification module independent from comment module.
- `packages/common/src/{constants,types,utils}/**`: config key, mask, types, and helpers must remain one shared source of truth.
- `packages/backend/src/module/system-config/system-config.service.ts`: dedicated secret access checks must run before generic `SYSTEM_` reads, and generic writes must remain blocked.
- `packages/backend/src/module/notification/**`: token/config and HTTP error bodies must never be logged wholesale or returned unmasked.
- `packages/frontend/src/pages/user/Dashboard/components/NotificationSettings.vue`: keep the token draft separate from masked response state and never echo the saved token.
- `docs/notification-templates/**`: variables must match backend constants exactly and render as escaped text.

Rollback requires no database action. Disable the notification key/policy first; revert notification module and comment integration if code rollback is needed.

## Pre-start checks

- Confirm planning summary approval in a user message after these artifacts are presented.
- Curate real spec/research entries in `implement.jsonl` and `check.jsonl`.
- Load the Phase 2 implementation context before dispatching the Trellis implementation agent.
