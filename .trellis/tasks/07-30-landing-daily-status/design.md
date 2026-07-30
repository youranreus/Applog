# Landing 今日状态展示 — Technical Design

## Architecture and boundaries

数据流保持单向且只读：

`Garmin Connect → Python worker → garmin_health_daily → NestJS allowlist DTO → Vue Landing`

- 只有 worker 持有 token 并访问 Garmin。
- `garmin_health_daily.summaryData` 保持私有；NestJS 显式挑选有限字段。
- 状态评分放在共享纯函数中，由服务端产生权威结果与分项信息；前端只负责呈现。测试可注入评估时刻，避免客户端时钟造成漂移。
- 3D 只消费状态枚举，不接触原始健康数据。

## Worker ingestion

### Authentication initialization

`GarminReadAdapter` 应通过依赖库标准 token 恢复入口完成 profile/settings 初始化。初始化后仍由现有 request budget 包围所有 Garmin 请求，并在成功提交时保存刷新后的 token。

### Daily summary domain

在 `get_health_payloads(calendarDate)` 增加 `daily_summary = get_stats(calendarDate)`，首选映射：

| Public concept | Primary | Fallback |
|---|---|---|
| steps | `daily_summary.totalSteps` | steps domain |
| Garmin step goal | `daily_summary.dailyStepGoal` | steps domain |
| resting heart rate | `daily_summary.restingHeartRate` | resting HR domain |
| moderate minutes | `daily_summary.moderateIntensityMinutes` | `intensity_minutes.moderateMinutes` |
| vigorous minutes | `daily_summary.vigorousIntensityMinutes` | `intensity_minutes.vigorousMinutes` |
| body battery | `daily_summary.bodyBatteryMostRecentValue` | latest valid body-battery series value |
| average stress | `daily_summary.averageStressLevel` | stress domain |
| sleep score | sleep payload real score only | null |
| sleep seconds | sleep payload | daily summary sleep duration if semantically equivalent |

Zero is a valid observation; invalid/non-finite values become null. Moderate and vigorous minutes remain separate in storage and combine for display as `moderate + 2 × vigorous`, matching Garmin intensity-minute semantics.

### Natural day

Add an explicit Garmin time-zone configuration using an IANA identifier (default `Asia/Shanghai` for backward compatibility in this deployment). Resolve today from `now.astimezone(ZoneInfo(timeZone)).date()`, then refresh today and yesterday. Persist the calendar date and freshness independently from UTC fetch time.

### Safe observability

Log only domain outcome and field-presence booleans/counts. Never log values, payload fragments, account identifiers, tokens or dates tied to private measurements. Tests assert log messages exclude known synthetic values.

## Public contract

Add a dedicated endpoint such as `GET /garmin/today`, returning `IGarminTodayStatus | null`:

- `calendarDate`, `fetchedAt`, `stale`
- `evaluation`: `status | null`, `score | null`, `confidence`, `evaluatedAt`
- `metrics`: `steps`, `stepGoal`, `restingHeartRateBpm`, `intensityMinutes`, `averageStressLevel`, `bodyBattery`, and a discriminated sleep metric (`score`, `duration`, or `missing`)

Use string-literal unions/constants rather than TypeScript enums. Clamp only display-safe bounded values; preserve null. The endpoint never triggers upstream Garmin calls.

## Step-goal configuration

Add an optional positive integer `landingStepGoal` to system base configuration and the admin system settings form. Validation accepts a conservative range (1,000–100,000). Resolution is config → Garmin → 8,000. A missing/invalid saved value behaves as unset.

## Evaluation model

### Inputs and weights

| Dimension | Weight | Normalized score |
|---|---:|---|
| sleep | 25 | real Garmin score 0–100; otherwise duration curve |
| body battery | 25 | current value 0–100 |
| stress | 20 | inverse Garmin average stress, bounded 0–100 |
| steps | 15 | actual steps / time-adjusted expected steps |
| intensity | 15 | weighted minutes / time-adjusted expected minutes |

Resting heart rate is display-only in MVP. For sleep-duration fallback, 7–9 hours maps to 100; under 4 hours maps to 0; values between interpolate; excessive duration tapers conservatively and is covered by boundary tests.

### Time-adjusted progress

- Active progress window: 08:00–22:00 Garmin local time.
- Before 08:00, steps and intensity dimensions are not eligible for scoring.
- From 08:00 to 22:00, expected fraction increases linearly from a small floor to 100%; actual/expected is capped at 100.
- After 22:00, full-day targets apply.
- Intensity daily target defaults to 30 weighted minutes and remains an internal documented constant for MVP.

### Missing data and confidence

- Re-normalize weights across available eligible dimensions.
- Require at least three valid dimensions and at least 50% of total eligible weight; otherwise evaluation is null.
- Confidence is available eligible weight / total eligible weight, exposed as a bounded 0–1 value.
- Initial status thresholds: `≥85` 活得很好！, `≥70` 活得不错, `≥50` 活着, `<50` 努力活着. Boundary tests are authoritative.

## Frontend composition

- Add a page hook dedicated to fetching today status; Landing page remains thin.
- Add a `LandingTodayStatus` feature folder with shell, metrics, progress and character components.
- Desktop uses a two-column card; at the existing mobile breakpoint it becomes character-first single column.
- Progress bars use native/ARIA progress semantics with text values; color is supplementary, never the sole signal.
- Loading, collecting, partial, stale and error presentations follow PRD R6.

## 3D character

- Construct the humanoid from DOM primitives grouped at shoulders, hips and neck, using native CSS perspective and `transform-style: preserve-3d`. No model loader, canvas renderer or external runtime is needed.
- State motion mapping:
  - 活得很好！：upright celebratory bounce/wave
  - 活得不错：relaxed rhythmic walk-in-place
  - 活着：slow neutral sway/breath
  - 努力活着：slouched, slow recovery breath
  - unranked: quiet neutral idle
- No pointer listeners, controls or JavaScript render loop. Background-tab animation scheduling is left to the browser.
- Reduced motion renders a fixed representative pose. Browsers without preserve-3d retain the same DOM silhouette, status label and accessible content.

## Compatibility, rollout and rollback

- Schema remains backward compatible because `summaryData` is JSON and public fields are nullable.
- Deploy worker parsing/auth fixes before exposing the frontend module; old rows can be reparsed from encrypted health archives where present, otherwise refresh today/yesterday.
- Endpoint returning null keeps the module in collecting state.
- Feature can be rolled back by removing the Landing composition while leaving safe ingestion improvements and data intact.
