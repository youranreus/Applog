# WakaTime Landing integration design

## Architecture

```text
Admin WakaTimeSettings
  → PUT /wakatime/config
  → SystemConfigService (SYSTEM_WAKATIME_CONFIG, masked API key)
  → WakaTimeService resets generation and starts background refresh

WakaTime Summaries API (30 local calendar days)
  → WakaTimeClient (unknown boundary, Basic Auth, status/error classification)
  → WakaTime normalizer (daily allowlist + 7/30 aggregates)
  → in-process snapshot/cache
  → GET /wakatime/stats → IWakaTimeLandingStats | null
  → Alova API → useLandingWakaTimeStats → LandingWakaTimeStats
```

The feature stays one task because its deliverables are a single dependent vertical slice: shared contract → backend snapshot → public API → Landing presentation. Splitting them would create blocking child tasks without independently useful shipped behavior.

## Shared contracts

Add `packages/common/src/types/wakatime.ts`, config helpers, constants, and barrel exports.

```text
IWakaTimeConfig
  apiKey: string
  timeZone: string
  enabled: boolean

IWakaTimeLandingStats
  range: { startDate, endDate, timeZone }
  summary30Days: { totalSeconds, dailyAverageSeconds, activeDays }
  summary7Days: { totalSeconds, dailyAverageSeconds, activeDays }
  days[]: { date, totalSeconds, aiChangeShare: number | null }
  languages[]: { name, seconds, share }
  editors[]: { name, seconds, share }
  ai: {
    changeShare: number | null
    changeShare7Days: number | null
    aiChanges: number | null
    humanChanges: number | null
    tokens: { input, cachedInput, output } // each number | null
    estimatedCostUsd: number | null
    sessions: number | null
    promptEvents: number | null
    promptsPerSession: number | null
    models[]: { name, changes, share, estimatedCostUsd: number | null }
  } | null
  fetchedAt: string
  stale: boolean
```

`WAKATIME_API_KEY_MASK` follows the existing `********` secret convention. Empty or masked updates retain the stored key. `DEFAULT_WAKATIME_TIME_ZONE` is `Asia/Shanghai`; only valid IANA names are accepted.

The public DTO is an allowlist. It cannot express project, repository, branch, dependency, entity, machine, raw UA, session ID, plan, account identity, or credential fields.

## Backend boundaries

### Configuration

Add `SYSTEM_WAKATIME_CONFIG_KEY` and typed get/set/mask helpers to the existing system-config boundary. Generic reads return masked JSON only to admins; generic writes reject the secret key. Dedicated `GET/PUT /wakatime/config` routes require `admin`.

Saving configuration increments a service generation, clears the current snapshot, cancels the meaning of older in-flight results, and launches a new background refresh. Old-generation results cannot repopulate cache.

### HTTP client

`WakaTimeClient` is the only third-party HTTP boundary:

- `GET https://wakatime.com/api/v1/users/current/summaries`
- query: inclusive 30-local-day `start`, `end`, configured `timezone`
- HTTP Basic Auth with API key as username; never query-string auth
- 15-second timeout; one retry only for network timeout
- accepts response as `unknown`; logging contains only stage, credential-free error kind, status, elapsed time, attempt
- error kinds: `unauthorized`, `payment`, `rate_limited`, `timeout`, `schema`, `upstream`

No raw payload or response body enters logs, cache DTOs, controller errors, fixtures, or frontend.

### Normalization

Pure utilities own all `unknown` decoding and aggregation:

- validate the response has a day array and valid `YYYY-MM-DD` keys
- clamp to the requested 30-day local calendar range and sort ascending
- preserve numeric zero; reject negative, non-finite, wrong-type and missing values
- aggregate time/language/editor/model by normalized name; Top 3 plus optional Other
- derive the 7-day view from the final seven local calendar keys
- compute AI share only as `(ai_additions + ai_deletions) / (AI + human additions/deletions)` when every required family is present and denominator > 0
- compute both 30-day and final-seven-calendar-day AI shares with that same weighted formula; never average daily percentages
- keep input/cached-input/output distinct; missing remains null
- sum estimated cost only when cost fields are actually present; present zero remains `0`, absent remains null
- sum sessions/prompt events independently, but compute prompts/session only when their daily coverage aligns and the session denominator is > 0
- normalize model/tool labels for display without merging semantically ambiguous families

### Refresh and cache

`WakaTimeService` implements `OnModuleInit` and `OnModuleDestroy` with one unref'ed 30-minute timer:

- startup, config save and interval trigger background refresh
- public `getLandingStats()` never awaits or initiates an upstream request; it returns fresh snapshot, stale snapshot, or null
- concurrent refresh triggers share one promise per generation
- successful refresh replaces the snapshot and expiry
- failure preserves last-known-good as stale and applies a short failure suppression window
- disabled/incomplete configuration returns null and does not call upstream
- snapshot is intentionally in-process for MVP; a restart may briefly return null until startup refresh succeeds

No new database table, Nest schedule dependency, or migration is required.

## Frontend presentation

Add a dedicated API module, page hook, view utilities and `LandingWakaTimeStats.vue`. The Landing page mounts it immediately before `LandingSlogan`, preserving independent loading and null hiding.

### Information hierarchy

1. Section heading: small kicker “AI Cost” and large title “开发状态”；fresh data adds no secondary timestamp, while stale data may show only “数据更新延迟”.
2. A single pale, finely bordered, shadowless usage card begins with the localized 30-day date range.
3. The card's main row shows aggregate token usage in large type and the WakaTime amount at the opposite edge. The amount has no label and prefixes known values with `~`; aggregate tokens sum only present input/cached-input/output values, and when every source is missing show `—`.
4. A single segmented bar encodes input, cached input and output proportions. Its compact textual legend is the only per-category presentation and includes color, name, token value and percentage, so the same data is not repeated above the bar and color is never the only signal. Missing categories remain visible as `—` but contribute no segment; an all-zero/unknown total renders an empty neutral track.
5. Without an internal divider, work environments/tools and AI models render as two titled groups of usage-sorted tags using a 3:2 desktop split. Editors use coding-time share; models use AI line-change share. There is no common-language group and no table-like Model list.
6. Code Pulse, four summary metrics, 7-day trends, fetched time and the explanatory line-change note are removed from the presentation.

Desktop uses the existing Landing content width. The hero row, segmented bar, compact token legend, and two tag groups reflow without page-level overflow at narrow widths. Tags expose percentages in addition to tint, zero/null differ, and skeleton shimmer is disabled under reduced motion.

The usage card is a compact data surface rather than a hero. Its aggregate-token type should stay around the existing section-title scale (roughly `1.75rem–2.35rem`, not `2.25rem–3.25rem`), with the amount one step below. Reduce padding and vertical gaps proportionally so the card becomes shorter without crowding legend values or tags. Do not add a separate token-detail row above the distribution bar or internal divider rules. The legend uses natural-width flex items rather than equal grid columns.

## Compatibility and failure behavior

- Existing Landing sections load independently; WakaTime null/error cannot hide or block them.
- API key remains compatible with the user's current WakaTime key, but production provisioning happens through admin settings.
- Missing new config is disabled by default.
- Unknown upstream fields are ignored; missing known fields degrade individual cards rather than failing the entire snapshot when core daily time remains usable.
- Cost `null` renders `—`; cost `0` is a real reported `$0.00`.
- Time-zone changes invalidate cache and recompute local date boundaries.

## Security and privacy

- Credential exists only in system config storage and outbound Authorization.
- Public JSON is constructed field-by-field from shared DTO types.
- Tests stringify the public result and assert forbidden key/value absence.
- No endpoint exposes raw WakaTime responses, projects, paths or identities.

## Rollback

The feature is additive. Rollback removes the WakaTime module import and Landing component/hook; existing sections and data remain unchanged. The unused `SYSTEM_WAKATIME_CONFIG` row is inert and contains no schema migration dependency.

## Deferred items

- Persistent snapshots surviving process restart.
- OAuth/multiple accounts, project allowlists, yearly history, Focus Halo/Durations, paid Insights, goals and public rankings.
- True provider bills or cross-provider pricing reconciliation.
