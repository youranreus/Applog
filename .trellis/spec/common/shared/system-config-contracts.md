# System Config Contracts

> Cross-layer payload rules for values stored inside `ISystemBaseConfig`.

## Scenario: Minute-precision site founded time

### 1. Scope / Trigger

Use this contract whenever code reads, edits, persists, or displays
`ISystemBaseConfig.siteFoundedDate`. The value crosses common, frontend, backend
JSON storage, and public footer rendering.

### 2. Signatures

```typescript
interface ISystemBaseConfig {
  siteFoundedDate?: string;
}

function parseSiteFoundedLocalTime(value: string): ISiteFoundedLocalTime | null;
function parseSiteFoundedTimestamp(value: string): number | null;
```

The shared interface lives in `@applog/common`. The framework-free parser lives
in frontend `utils/site-uptime.ts` and is the single parsing source for the
settings form and uptime display.

### 3. Contracts

- Canonical saved value: local wall-clock time `YYYY-MM-DDTHH:mm`.
- Backward-compatible value: `YYYY-MM-DD`, interpreted as local `00:00`.
- Empty string or missing field: hide the public uptime text.
- Do not append `Z` or convert this setting to UTC; it represents the site's
  configured local civil time.
- The backend stores the base-config JSON string unchanged; consumers own the
  field-level parsing contract.

### 4. Validation & Error Matrix

| Input | Result |
|---|---|
| Valid `YYYY-MM-DDTHH:mm` | Parse to the exact local minute |
| Valid legacy `YYYY-MM-DD` | Parse at local `00:00` |
| Empty / missing | No uptime display |
| Invalid calendar day | Parser returns `null` |
| Hour outside `00..23` or minute outside `00..59` | Parser returns `null` |
| Extra suffix, seconds, timezone, or malformed text | Parser returns `null` |

### 5. Good / Base / Bad Cases

- Good: `2026-07-26T13:45` preserves `13:45` through save and display.
- Base: `2026-07-26` remains readable as `2026-07-26T00:00` behavior.
- Bad: `2026-02-30T10:00`, `2026-07-26T24:00`, and
  `2026-07-26Tgarbage` are rejected.

### 6. Tests Required

- Parser unit assertions cover canonical, legacy, invalid-day, invalid-time,
  and trailing-garbage inputs.
- Uptime assertion verifies a one-minute difference from a configured minute.
- Frontend type-check verifies the computed time model writes
  `YYYY-MM-DDTHH:mm` without weakening `ISystemBaseConfig`.

### 7. Wrong vs Correct

```typescript
// Wrong: discards the selected minute and may introduce UTC shifts.
new Date(`${siteFoundedDate.slice(0, 10)}T00:00:00Z`);

// Correct: use the shared frontend boundary parser everywhere.
const foundedAt = parseSiteFoundedTimestamp(siteFoundedDate);
```

