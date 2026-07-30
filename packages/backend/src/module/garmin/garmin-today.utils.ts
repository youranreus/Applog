import {
  GARMIN_TODAY_STATUS,
  type GarminTodaySleepMetric,
  type IGarminTodayEvaluation,
  type IGarminTodayMetrics,
} from '@applog/common';

const WEIGHTS = { sleep: 25, bodyBattery: 25, stress: 20, steps: 15, intensity: 15 } as const;
const INTENSITY_TARGET = 30;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function sleepScore(sleep: GarminTodaySleepMetric): number | null {
  if (sleep.kind === 'score') return clamp(sleep.score);
  if (sleep.kind === 'missing') return null;
  const hours = sleep.seconds / 3600;
  if (hours < 4) return 0;
  if (hours < 7) return ((hours - 4) / 3) * 100;
  if (hours <= 9) return 100;
  return clamp(100 - (hours - 9) * 20);
}

function progressFraction(localHour: number): number | null {
  if (localHour < 8) return null;
  if (localHour >= 22) return 1;
  return 0.1 + ((localHour - 8) / 14) * 0.9;
}

/** Return local calendar date and fractional hour in an IANA time zone. */
export function getGarminLocalClock(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = read('year');
  const month = read('month');
  const day = read('day');
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    hour: read('hour') + read('minute') / 60,
  };
}

/** Deterministically evaluate allowlisted daily metrics at a supplied local hour. */
export function evaluateGarminToday(
  metrics: IGarminTodayMetrics,
  evaluatedAt: Date,
  localHour: number,
): IGarminTodayEvaluation {
  const values: Array<{ weight: number; score: number }> = [];
  const sleep = sleepScore(metrics.sleep);
  if (sleep !== null) values.push({ weight: WEIGHTS.sleep, score: sleep });
  if (metrics.bodyBattery !== null)
    values.push({ weight: WEIGHTS.bodyBattery, score: clamp(metrics.bodyBattery) });
  if (metrics.averageStressLevel !== null)
    values.push({ weight: WEIGHTS.stress, score: clamp(100 - metrics.averageStressLevel) });

  const fraction = progressFraction(localHour);
  if (fraction !== null && metrics.steps !== null)
    values.push({
      weight: WEIGHTS.steps,
      score: clamp((metrics.steps / Math.max(1, metrics.stepGoal * fraction)) * 100),
    });
  if (fraction !== null && metrics.intensityMinutes !== null)
    values.push({
      weight: WEIGHTS.intensity,
      score: clamp((metrics.intensityMinutes / (INTENSITY_TARGET * fraction)) * 100),
    });

  const eligibleWeight = localHour < 8 ? 70 : 100;
  const availableWeight = values.reduce((sum, value) => sum + value.weight, 0);
  const confidence = clamp(availableWeight / eligibleWeight, 0, 1);
  if (values.length < 3 || availableWeight < eligibleWeight * 0.5) {
    return { status: null, score: null, confidence, evaluatedAt: evaluatedAt.toISOString() };
  }
  const score = values.reduce((sum, value) => sum + value.score * value.weight, 0) / availableWeight;
  const rounded = Math.round(score);
  const status = score >= 85
    ? GARMIN_TODAY_STATUS.GREAT
    : score >= 70
      ? GARMIN_TODAY_STATUS.GOOD
      : score >= 50
        ? GARMIN_TODAY_STATUS.ALIVE
        : GARMIN_TODAY_STATUS.STRUGGLING;
  return { status, score: rounded, confidence, evaluatedAt: evaluatedAt.toISOString() };
}
