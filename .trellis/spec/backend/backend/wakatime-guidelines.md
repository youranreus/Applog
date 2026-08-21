# WakaTime Landing Statistics Contract

> Cross-layer executable contract for the admin-managed WakaTime integration and public usage card.

## 1. Scope / Trigger

Use this contract whenever changing WakaTime configuration, Summaries decoding, snapshot refresh, the public DTO/API, or the Landing usage card. `WakaTimeClient` is the only outbound HTTP boundary; the browser reads only the Applog snapshot and never contacts WakaTime.

The MVP fetches one inclusive 30-local-calendar-day Summaries range. Stats, Insights, User Agents, Durations, Heartbeats, project/file/session data, and provider billing are outside this path.

## 2. Signatures

| Layer      | Signature                                                                             | Authorization / behavior                                      |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Admin API  | `GET /wakatime/config -> Promise<IWakaTimeConfig>`                                    | `admin`; API key is masked                                    |
| Admin API  | `PUT /wakatime/config` with `SetWakaTimeConfigDto -> Promise<IWakaTimeConfig>`        | `admin`; empty or `********` key retains the stored key       |
| Public API | `GET /wakatime/stats -> IWakaTimeLandingStats \| null`                                | public; synchronous in-process snapshot read only             |
| Upstream   | `GET /api/v1/users/current/summaries?start=YYYY-MM-DD&end=YYYY-MM-DD&timezone=<IANA>` | server-owned Basic Auth; response enters the app as `unknown` |
| Service    | `refreshFromStoredConfig(): Promise<IWakaTimeLandingStats \| null>`                   | startup/config-save/timer background trigger                  |
| Service    | `getLandingStats(): IWakaTimeLandingStats \| null`                                    | never starts or awaits upstream work                          |

Storage key is `SYSTEM_WAKATIME_CONFIG`. The shared secret mask is `WAKATIME_API_KEY_MASK = "********"`.

## 3. Contracts

### Configuration

```ts
interface IWakaTimeConfig {
  apiKey: string;
  timeZone: string; // valid IANA name; default Asia/Shanghai
  enabled: boolean;
}
```

`apiKey` and `timeZone` must be strings within DTO length limits; `enabled` must be boolean. A config is fetchable only when enabled, the trimmed key is non-empty, and the time zone is valid.

### Public response and privacy

`IWakaTimeLandingStats` is an allowlist containing only `range`, 7/30-day summaries, daily totals/AI share, normalized languages/editors, normalized AI metrics, `fetchedAt`, and `stale`. Public JSON must not contain project, repository, branch, dependency, entity/path, machine, raw user agent, session ID, account/plan, Authorization, or credentials.

AI line-change share is:

```text
(ai_additions + ai_deletions)
────────────────────────────────────────────────────────
ai_additions + ai_deletions + human_additions + human_deletions
```

All four fields must be covered and the denominator must be positive; otherwise the result is `null`. Never substitute `ai_line_changes_total` or average daily percentages.

Input, cached-input, and output token values remain independently nullable. Aggregate display tokens sum known values and are `null` only when all three are missing. Token shares exclude missing values; reported all-zero values produce explicit `0%` and an empty neutral track. Estimated cost is WakaTime's estimate: missing is `—`, numeric zero is `$0.00`.

### Landing presentation

The section is immediately above the Landing Slogan. Its kicker/title are `AI Cost` / `开发状态`, and it renders one pale, finely outer-bordered, internally divider-free, shadowless usage card in this order:

1. localized snapshot period, without fetched/updated time;
2. aggregate tokens and formatted amount, with no amount label and `~` prefixed only to known values;
3. one segmented share bar plus a compact natural-width flex legend that is the sole per-category presentation and carries color key, name, token value, and percentage;
4. work-environment/tool tags from editors and AI-model tags from model line-change share, using a 3:2 desktop split.

Tags are stable-sorted by descending share and always retain visible percentages. Empty groups keep their label and display `—`. Do not render four summary metrics, 7-day hints, common languages, Code Pulse, explanatory note, or a table-style Model list.

Treat the card as a compact data surface, not a hero banner. Keep the aggregate Token scale around `1.75rem–2.35rem`, the amount one typographic step below it, and tighten padding, section gaps, legend, tags, and loading skeleton together. Density changes must preserve the typed-props-only presentation boundary and must not introduce page-level overflow at 390px.

## 4. Validation & Error Matrix

| Condition                                                                | Required result                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Non-admin reads/writes config                                            | authorization rejection                                         |
| Generic system-config write attempts WakaTime secret key                 | reject; dedicated endpoint only                                 |
| Empty or masked key on update with stored key                            | retain stored key                                               |
| Enabled config lacks key or has invalid IANA zone                        | no upstream request; public response `null`                     |
| Upstream 401/403, 402, 429, timeout, malformed payload, or other failure | credential-free error kind; never log body/key/header           |
| Refresh fails with last-known-good snapshot                              | preserve it and expose `stale: true`                            |
| Refresh fails before first success                                       | public response `null`; other Landing sections continue         |
| Config changes during an in-flight request                               | generation mismatch prevents old result from repopulating cache |
| AI denominator is zero or required family is missing                     | AI share `null`, never `0%`                                     |
| Token field is missing                                                   | legend `—`; no share segment                                    |
| All reported token fields are zero                                       | total `0`, each known share `0%`, neutral track                 |
| Estimated cost is missing / zero                                         | `—` / `$0.00` respectively                                      |

## 5. Good / Base / Bad Cases

- Good: valid config yields a 30-day allowlisted snapshot; the public card shows period, token composition, amount, tools, and models without exposing raw context.
- Base: configuration is disabled or the first refresh has not completed; `GET /wakatime/stats` returns `null` and the Landing omits only this section.
- Good degradation: one token category is missing; known values remain visible, the aggregate and share bar use only known values, and the missing legend entry stays `—`.
- Bad: browser fetches WakaTime directly, UI derives values from an untyped raw payload, logs include an upstream body, or missing values are coerced to zero.

## 6. Tests Required

- Common: mask/retention helpers, default/invalid IANA time zone, configured predicate.
- Client: Basic Auth request shape, timeout retry/exhaustion, 401/402/429/schema classification, and absence of secrets/raw bodies in errors and logs.
- Normalizer: unknown decoding, date clamping/sorting, weighted AI denominator, null-versus-zero tokens/cost, Top-N aggregation, and final-seven-day slicing.
- Service: disabled/cold start, single-flight, TTL/failure suppression, stale fallback, generation race, timer cleanup, and synchronous public reads.
- Public boundary: stringify the response and assert all forbidden fields/key values are absent.
- Frontend: date range, aggregate/share math for complete/partial/all-zero/all-null inputs, cost zero/null, stable tag sorting, section order, removed-content regression, mobile wrapping, textual color-independent semantics, and reduced-motion skeleton behavior.

Build `@applog/common` before backend/frontend consumers, then run both test suites, backend/frontend builds, frontend type-check/lint, changed-file formatting, and `git diff --check`.

## 7. Wrong vs Correct

### Wrong

```ts
// Public requests leak latency and credentials into the browser path.
const raw = await fetch("https://wakatime.com/api/v1/users/current/summaries");
const tokens = (raw.input ?? 0) + (raw.cached_input ?? 0) + (raw.output ?? 0);
```

### Correct

```ts
// Backend refresh owns the secret/raw boundary; public requests read only an allowlist.
void wakaTimeService.refreshFromStoredConfig();
const snapshot: IWakaTimeLandingStats | null =
  wakaTimeService.getLandingStats();

// Missing and real zero remain distinct in presentation helpers.
const total = sumKnownTokens([input, cachedInput, output]);
```
