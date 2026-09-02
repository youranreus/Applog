# Tokscale Landing Statistics Contract

> Cross-layer contract for the base-configured Tokscale integration and public AI Cost card.

## 1. Scope / Trigger

Use this contract whenever changing Tokscale username config, public profile decoding, snapshot refresh, the public DTO/API, or the Landing AI Cost card. `TokscaleClient` is the only outbound HTTP boundary; browsers read only the Applog snapshot and never contact Tokscale.

## 2. Signatures

| Layer | Signature | Authorization / behavior |
| --- | --- | --- |
| Base config | `ISystemBaseConfig.tokscaleUsername?: string` | Empty after trim disables the section |
| Public API | `GET /tokscale/stats -> ITokscaleLandingStats \| null` | Public; synchronous in-process snapshot read only |
| Upstream | `GET https://tokscale.ai/api/users/{username}?period=month` | Server-owned public GET; no credentials |
| Service | `refreshFromStoredConfig(): Promise<ITokscaleLandingStats \| null>` | Startup/timer background trigger; rereads base config every time |
| Service | `getLandingStats(): ITokscaleLandingStats \| null` | Never starts or awaits upstream work |

## 3. Contracts

- Tokscale username lives in `SYSTEM_BASE_CONFIG`, not a dedicated secret key. Missing, non-string, or trimmed empty means disabled and must skip upstream I/O.
- `TokscaleClient.getUserProfile(username)` uses `period=month`, `Accept: application/json`, 15s timeout, follows redirects, and retries only connection timeouts once after a short delay.
- Error kinds are `not_found`, `ambiguous`, `rate_limited`, `timeout`, `upstream`, and normalizer-owned `schema`. Logs include kind/status/elapsedMs/attempt where relevant and never include username or response body.
- Normalization sorts `contributions` by `date`, selects the last natural day whose `totals.tokens > 0`, filters `<synthetic>` models, uses legacy `modelId` only when model maps are empty, resolves known client display names, and keeps unknown client ids as-is.
- Public DTO is an allowlist: day, total token/cost, five token buckets, client/model usage, `updatedAt`, `fetchedAt`, `stale`. It must not include user profile, avatar, rank, devices, sessions, MCP servers, credentials, or raw upstream payloads.
- Cache: success TTL 10 minutes, failure suppression 1 minute, single-flight per generation, stale last-known-good on failures, cold-start failure returns `null`.
- Every refresh rereads `getBaseConfigRaw().tokscaleUsername`; username changes clear the snapshot and advance generation so old in-flight responses cannot repopulate the cache.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Username missing / non-string / empty | No upstream request; public response `null` |
| Username changes | Clear old snapshot immediately; old in-flight result ignored |
| Upstream 404 / 409 / 429 / timeout / other non-2xx | Credential-free kind; no body/username in logs |
| `contributions` missing/non-array or all zero | `TokscalePayloadSchemaError`; service returns `null` or stale old snapshot |
| `<synthetic>` appears in `clients[].models` | Filter it out |
| Client model map empty and `modelId` non-empty | Synthesize one model row from client totals |
| Snapshot expired and refresh fails | Keep last-known-good with `stale: true` |
| Public `GET /tokscale/stats` called repeatedly | Synchronous read only; no upstream calls |

## 5. Good / Base / Bad Cases

- Good: configured username yields a one-day allowlisted snapshot with software groups and model rows sorted by cost.
- Base: username empty or first refresh fails; `GET /tokscale/stats` returns `null` and Landing omits only AI Cost.
- Good degradation: unknown client id renders as that id; old snapshot remains visible with delayed marker during upstream failure.
- Bad: browser calls `tokscale.ai`, public request triggers upstream refresh, service logs usernames/bodies, or UI renders raw profile fields.

## 6. Tests Required

- Client: URL/period/timeout/redirect settings, timeout retry/exhaustion, 404/409/429 classification, logs/errors omit username and body.
- Normalizer: fixture contract, date sorting, last positive day selection, trailing zero day skip, `<synthetic>` filtering, legacy `modelId`, cost sorting, token/cost invariants, forbidden public fields.
- Service: synchronous public read, empty username skip, single-flight, TTL/stale fallback, failure suppression, username-change generation race, timer `unref` and cleanup.
- Frontend: token/cost/date formatting, delayed threshold at >3 days, five bucket shares, section order, zero bucket hiding, model grid tabular alignment, 390px no overflow.

## 7. Wrong vs Correct

### Wrong

```ts
// Browser owns upstream latency and exposes a raw public profile shape.
const raw = await fetch(`https://tokscale.ai/api/users/${username}?period=month`);
```

### Correct

```ts
// Backend refresh owns raw boundary; public requests read only allowlisted memory.
void tokscaleService.refreshFromStoredConfig();
const snapshot = tokscaleService.getLandingStats();
```
