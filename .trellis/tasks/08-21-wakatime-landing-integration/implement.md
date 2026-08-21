# WakaTime Landing integration implementation plan

## 1. Shared contract and configuration

- [x] Add WakaTime config/public DTO types, constants and pure masking/retention helpers in `@applog/common`; export them from the barrel.
- [x] Define null/zero semantics and the public forbidden-field boundary in code comments/tests.
- [x] Extend system-config typed key handling, dedicated raw/masked get/set methods, generic read masking and generic write rejection.
- [x] Add admin configuration DTO validation for API key, enabled and IANA time zone.
- [x] Validate with common build and focused system-config unit tests before continuing.

## 2. Backend WakaTime vertical slice

- [x] Add `wakatime.constants.ts`, credential-free client error types and `WakaTimeClient` for the single Summaries request.
- [x] Add pure unknown decoders/normalizers for calendar days, 7/30 summaries, AI share, tokens, cost/model aggregation, languages/editors and fallback rhythm.
- [x] Add `WakaTimeService` generation-safe background refresh, single-flight, TTL/failure suppression, stale/null behavior and lifecycle timer cleanup.
- [x] Add public `GET /wakatime/stats` plus admin `GET/PUT /wakatime/config`, module export and app registration.
- [x] Test timeout retry/exhaustion, 401/402/429/schema classification, no-secret logs/errors, invalid/zero/missing fields, AI denominator, cost null-vs-zero, Top-N, 7-day slicing, time zone, concurrency, generation race, stale fallback and public allowlist.
- [x] Run backend focused unit tests and build. Roll back this step by removing the new module import if the vertical slice cannot meet the privacy contract.

## 3. Admin and public frontend

- [x] Add typed Alova methods for public stats and admin masked config.
- [x] Add `WakaTimeSettings.vue` beside Duolingo settings with enable switch, password input, time-zone field, masked-key retention, save/reload states and standard notifications.
- [x] Add Landing hook with independent soft degradation.
- [x] Add tested pure format/presentation utilities for duration, compact token numbers, USD estimate, null-vs-zero, heatmap intensity/labels and 7-day trend text.
- [x] Build `LandingWakaTimeStats.vue` with summary cards, 30-day Code Pulse, token row, estimated-cost/model panel or AI rhythm fallback, stack ribbons, model/tool lists, skeleton/stale/mobile/a11y states.
- [x] Mount the section after Recent Posts and before personal status/fitness/learning sections.
- [x] Run frontend unit tests, type-check, file-level lint and build; inspect desktop, 800px and 390px layouts with reduced motion.

## 4. Cross-layer verification and spec capture

- [x] Build common first, then run the complete backend unit suite/build and frontend unit suite/type-check/lint/build.
- [x] Verify a browser-facing snapshot contains only the shared allowlist and no WakaTime credential/raw context; verify browser network traffic only targets Applog.
- [x] Verify disabled, cold-start, stale, upstream failure, cost-null fallback and fully populated states without affecting other Landing sections.
- [x] Add a WakaTime cross-layer contract to `.trellis/spec/` and link it from backend/frontend/common indexes.
- [x] Run `git diff --check`, review final diff and use Trellis check before commit.

## 5. Impeccable visual distillation

- [x] Remove Code Pulse from the component tree and delete its orphaned component/test assertions.
- [x] Remove all borders/backgrounds from the four top metrics while preserving responsive scanability.
- [x] Consolidate token and amount values into one pale 8px resource surface; remove model-cost progress bars and the interaction-rhythm replacement panel.
- [x] Replace language/editor/model cards and progress tracks with one row of titled, usage-sorted, share-tinted tags that retain textual values.
- [x] Update frontend tests and WakaTime cross-layer spec, then rerun frontend lint/type-check/tests/build and 1280/390 visual checks.

## 6. Single usage-card refinement

- [x] Move `LandingWakaTimeStats` immediately below `LandingYesterdayStatus`.
- [x] Remove the four summary metrics, 7-day hints, common-language group, fetched timestamp and explanatory note.
- [x] Recompose the feature as one light usage card: localized period, total tokens/amount, accessible segmented share bar and compact per-category legend.
- [x] Keep only work environment/tool and AI model tag groups inside the same card, sorted by share and retaining visible percentages.
- [x] Remove orphaned components/utilities, update frontend tests/specs and verify desktop/mobile/reduced-motion states.

## 7. Compact density polish

- [x] Reduce the aggregate Token and amount type scales so the card no longer reads as a hero banner.
- [x] Tighten card padding, vertical section gaps, details/legend/tag sizing, and loading-skeleton height as one coherent density pass.
- [x] Preserve the existing component boundary: `LandingWakaTimeStats` owns section/loading state; `WakaTimeUsageCard` owns presentation through typed props only.
- [x] Verify changed-file formatting, frontend tests/type-check/lint/build, and 390px overflow behavior.

## 8. Token legend deduplication

- [x] Remove the standalone Input/Cached Input/Output detail row and its orphaned styles.
- [x] Make the legend the sole per-token-category presentation, retaining name, formatted value, percentage and color key in a tighter layout.
- [x] Preserve the segmented bar's accessible summary and null/zero semantics; update regression tests/specs.
- [x] Run frontend tests/type-check/lint/build, changed-file formatting and `git diff --check`.

## 9. Accepted presentation tweaks

- [x] Remove internal divider rules, use a 3:2 tools/models split, and change the Token legend to natural-width flex wrapping.
- [x] Use `AI Cost` / `开发状态`, remove the amount label, and prefix known amount values with `~`.
- [x] Place the WakaTime section immediately above the Landing Slogan and record user acceptance.

## Validation commands

```bash
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run build
git diff --check
```

## Risk and rollback points

- The highest-risk boundary is third-party normalization. Do not let downstream code cast raw WakaTime fields; fixtures and decoder tests gate the backend service.
- Background timer behavior must not keep tests/process shutdown alive; inject time/sleep where needed and `unref`/clear timers.
- System-config edits touch generic secret access. Focused regression tests for Duolingo/Umami/notification keys must remain green.
- Frontend amount rendering must distinguish missing from numeric zero. A regression here can publicly misstate billing.
