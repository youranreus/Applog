# Duolingo Landing Statistics Contract

> Cross-layer contract for the admin-managed Duolingo integration and public Landing learning narrative.

## Boundaries

- Shared shapes and secret helpers live in `@applog/common`.
- `DuolingoClient` is the only Duolingo HTTP boundary. It accepts third-party payloads as `unknown`, sends JWT only in server-side `Authorization`, and emits credential-free error kinds.
- `DuolingoService` owns configuration, normalization, cache, single-flight, and soft degradation.
- The public `GET /duolingo/stats` returns only `IDuolingoLandingStats | null`.
- Frontend pages use `src/api/duolingo` through hooks/components; they never call Duolingo directly.

## Configuration and secret contract

- Storage key: `SYSTEM_DUOLINGO_CONFIG`.
- Shape: `IDuolingoConfig { username, jwt, timeZone, enabled }`.
- Admin endpoints: `GET/PUT /duolingo/config`.
- Admin reads replace a non-empty JWT with `DUOLINGO_JWT_MASK`.
- Empty or masked JWT writes retain the stored JWT.
- Generic system-config reads require admin and are masked; generic writes reject this key.
- `timeZone` must be a valid IANA name. `enabled`, username, JWT, and time zone must all be usable before public fetching begins.

## Data semantics

- Streak: `site_streak ?? streak`, non-negative integer only.
- League: fallback through direct/tracking/language tier, strictly `0..9`; it is a tier, never a leaderboard rank.
- Seven-day window includes today and six prior calendar days in the configured time zone.
- Missing XP days are `0`. A day without a summary has `learningSeconds: 0`; a summary whose duration field is absent has `learningSeconds: null`. Any unknown active-day duration makes the seven-day total `null`.
- Language XP groups by `learningLanguage`, excludes explicit non-language subjects, uses all valid language XP as the denominator, then returns at most two.
- The current-year calendar is complete. Elapsed missing dates are zero; future dates are `{ xp: null, future: true }`.
- `YYYY-MM-DD` strings are calendar keys. Only Unix timestamps are converted through `timeZone`.

## Cache and failure contract

- Successful snapshot TTL: 30 minutes; first-failure suppression: 1 minute.
- Same-generation concurrent requests share one in-flight promise.
- Expired successful snapshots return immediately with `stale: true` while a single background refresh runs.
- Without a snapshot, upstream failure returns `null`; Landing hides the section and other requests continue.
- Saving config clears cache and advances generation. An old in-flight response must neither overwrite the new cache nor return the previous configuration's snapshot to its original public caller.

## Frontend presentation

- Place the section after Landing Profile and before Recent Posts.
- While `useLandingDuolingoStats().loading` is true, show a layout-matching skeleton (real section title, shimmer placeholders for metrics / languages / heatmap); hide the section entirely when loading finishes with `null`.
- Four quiet typographic metrics, at most two language cards, and a dependency-free yearly heatmap.
- The mobile heatmap scrolls inside its own region and defaults near the current week; it must not create page-level horizontal overflow.
- Zero, future, positive intensity, stale state, and per-day values require text/accessible names, not color alone.
- Include a brief non-affiliation statement and respect reduced-motion preferences.

## Verification

Run common build, backend unit tests/build, frontend unit tests/type-check/build, file-level lint, and `git diff --check`. Tests must cover secret preservation, invalid time zones, schema/error classification, cross-year and leap-year dates, duration null semantics, tier bounds, language denominator, cache concurrency, stale fallback, and generation races.
