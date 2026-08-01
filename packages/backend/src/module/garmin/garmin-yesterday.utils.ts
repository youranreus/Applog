import {
  GARMIN_YESTERDAY_STATUS,
  type GarminYesterdaySleepMetric,
  type IGarminYesterdayEvaluation,
  type IGarminYesterdayMetrics,
} from '@applog/common';

const WEIGHTS = {
  sleep: 25,
  bodyBattery: 25,
  stress: 20,
  steps: 15,
  intensity: 15,
} as const;
const INTENSITY_TARGET = 30;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function sleepScore(sleep: GarminYesterdaySleepMetric): number | null {
  if (sleep.kind === 'score') return clamp(sleep.score);
  if (sleep.kind === 'missing') return null;
  const hours = sleep.seconds / 3600;
  if (hours < 4) return 0;
  if (hours < 7) return ((hours - 4) / 3) * 100;
  if (hours <= 9) return 100;
  return clamp(100 - (hours - 9) * 20);
}

/** Return yesterday's local calendar date in an IANA time zone. */
export function getGarminYesterdayDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = read('year');
  const month = read('month');
  const day = read('day');
  const localToday = new Date(Date.UTC(year, month - 1, day));
  localToday.setUTCDate(localToday.getUTCDate() - 1);
  return localToday.toISOString().slice(0, 10);
}

/** Deterministically evaluate allowlisted metrics for one complete local day. */
export function evaluateGarminYesterday(
  metrics: IGarminYesterdayMetrics,
  evaluatedAt: Date,
): IGarminYesterdayEvaluation {
  const values: Array<{ weight: number; score: number }> = [];
  const sleep = sleepScore(metrics.sleep);
  if (sleep !== null) values.push({ weight: WEIGHTS.sleep, score: sleep });
  if (metrics.bodyBattery !== null)
    values.push({
      weight: WEIGHTS.bodyBattery,
      score: clamp(metrics.bodyBattery),
    });
  if (metrics.averageStressLevel !== null)
    values.push({
      weight: WEIGHTS.stress,
      score: clamp(100 - metrics.averageStressLevel),
    });

  if (metrics.steps !== null)
    values.push({
      weight: WEIGHTS.steps,
      score: clamp((metrics.steps / Math.max(1, metrics.stepGoal)) * 100),
    });
  if (metrics.intensityMinutes !== null)
    values.push({
      weight: WEIGHTS.intensity,
      score: clamp((metrics.intensityMinutes / INTENSITY_TARGET) * 100),
    });

  const eligibleWeight = 100;
  const availableWeight = values.reduce((sum, value) => sum + value.weight, 0);
  const confidence = clamp(availableWeight / eligibleWeight, 0, 1);
  if (values.length < 3 || availableWeight < eligibleWeight * 0.5) {
    return {
      status: null,
      score: null,
      confidence,
      evaluatedAt: evaluatedAt.toISOString(),
    };
  }
  const score =
    values.reduce((sum, value) => sum + value.score * value.weight, 0) /
    availableWeight;
  const rounded = Math.round(score);
  const status =
    score >= 85
      ? GARMIN_YESTERDAY_STATUS.GREAT
      : score >= 70
        ? GARMIN_YESTERDAY_STATUS.GOOD
        : score >= 50
          ? GARMIN_YESTERDAY_STATUS.ALIVE
          : GARMIN_YESTERDAY_STATUS.STRUGGLING;
  return {
    status,
    score: rounded,
    confidence,
    evaluatedAt: evaluatedAt.toISOString(),
  };
}
