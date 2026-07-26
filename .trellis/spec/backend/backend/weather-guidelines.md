# Weather Guidelines

> Open-Meteo-backed public current weather for `@applog/backend`.

## Scenario: Configurable Landing current weather

### 1. Scope / Trigger

- Trigger: public UI needs current weather for the city stored in `SYSTEM_BASE_CONFIG.weatherCity`.
- The browser never calls Open-Meteo directly; backend owns external I/O, normalization, caching, and soft failure.

### 2. Signatures

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/weather/current` | Public |

```ts
type Response = {
  city: string;
  weather: string;
  temperatureC: number;
} | null;
```

### 3. Contracts

- Config source: optional `ISystemBaseConfig.weatherCity`; missing, non-string, or trimmed empty means disabled.
- Provider: Open-Meteo geocoding (`count=1`, `language=zh`) then forecast current `temperature_2m,weather_code` with `timezone=auto`.
- Normalize temperature to one decimal and WMO code to short Chinese text; unknown code returns `null`.
- Cache key is normalized city text. Success TTL is 10 minutes; failure TTL is 1 minute; same-city requests share one in-flight Promise.
- External HTTP may use the repository's existing Axios dependency inside the dedicated client adapter; controllers and domain services must not issue raw HTTP.

### 4. Validation & Error Matrix

| Condition | Behavior |
|-----------|----------|
| City missing / non-string / empty | Return `null`; do not call provider |
| Geocoding has no finite coordinates | Log warning; cache failure; return `null` |
| Timeout / non-2xx / unexpected provider throw | Log without secrets; cache failure; return `null` |
| Temperature non-finite or weather code unknown | Cache failure; return `null` |
| Valid negative temperature | Preserve it after one-decimal normalization |

### 5. Good/Base/Bad Cases

- Good: `深圳` resolves → `{ city: '深圳', weather: '多云', temperatureC: 23.5 }` and concurrent callers share the request.
- Base: city empty or provider unavailable → `null`; the Landing hides only weather.
- Bad: exposing provider response directly, throwing a public 500, or letting the frontend call Open-Meteo.

### 6. Tests Required

- Unit: WMO mapping, temperature normalization, unknown/invalid values.
- Unit: empty/non-string city skips provider; same-city single-flight; success/failure cache behavior; unexpected client throw soft-degrades.
- Manual: `/weather/current` never exposes coordinates, provider URLs, or credentials; Landing remains usable when it returns `null`.

### 7. Wrong vs Correct

#### Wrong

```ts
// Browser owns provider details and every visit creates two external requests.
fetch(`https://api.open-meteo.com/v1/forecast?...`);
```

#### Correct

```ts
// Controller returns a safe DTO; WeatherService owns config, cache, and fallback.
return this.weatherService.getCurrentWeather(); // DTO | null
```

## Related

- Shared city field: `common/shared/package-boundaries.md`
- Implementation: `packages/backend/src/module/weather/`
- Task: `.trellis/tasks/07-26-landing-page-refactor/`
