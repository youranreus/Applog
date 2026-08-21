import type {
  IWakaTimeAiModel,
  IWakaTimeBreakdownItem,
  IWakaTimeDayStats,
  IWakaTimeLandingStats,
  IWakaTimePeriodSummary,
} from '@applog/common';
import { WAKATIME_RANGE_DAYS } from './wakatime.constants';

type UnknownRecord = Record<string, unknown>;

export class WakaTimePayloadSchemaError extends Error {
  constructor() {
    super('WakaTime summaries schema');
    this.name = 'WakaTimePayloadSchemaError';
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function dateKey(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function addWakaTimeCalendarDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

export function wakaTimeDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function getWakaTimeDateRange(
  timeZone: string,
  now = new Date(),
): { startDate: string; endDate: string } {
  const endDate = wakaTimeDateInTimeZone(now, timeZone);
  return {
    startDate: addWakaTimeCalendarDays(endDate, -(WAKATIME_RANGE_DAYS - 1)),
    endDate,
  };
}

function sumQuartet(grand: UnknownRecord): {
  ai: number;
  human: number;
} | null {
  const values = [
    nonNegative(grand.ai_additions),
    nonNegative(grand.ai_deletions),
    nonNegative(grand.human_additions),
    nonNegative(grand.human_deletions),
  ];
  if (values.some((value) => value === null)) return null;
  return {
    ai: (values[0] ?? 0) + (values[1] ?? 0),
    human: (values[2] ?? 0) + (values[3] ?? 0),
  };
}

function aiShare(changes: { ai: number; human: number } | null): number | null {
  if (!changes || changes.ai + changes.human <= 0) return null;
  return changes.ai / (changes.ai + changes.human);
}

interface IParsedDay {
  date: string;
  totalSeconds: number;
  changes: { ai: number; human: number } | null;
  grand: UnknownRecord;
  languages: unknown[];
  editors: unknown[];
}

function parseDay(value: unknown): IParsedDay | null {
  const record = asRecord(value);
  const range = asRecord(record?.range);
  const grand = asRecord(record?.grand_total);
  const date = dateKey(range?.date);
  const totalSeconds = nonNegative(grand?.total_seconds);
  if (!record || !grand || !date || totalSeconds === null) return null;
  return {
    date,
    totalSeconds,
    changes: sumQuartet(grand),
    grand,
    languages: Array.isArray(record.languages) ? record.languages : [],
    editors: Array.isArray(record.editors) ? record.editors : [],
  };
}

function buildPeriod(days: IParsedDay[]): IWakaTimePeriodSummary {
  const totalSeconds = days.reduce((sum, day) => sum + day.totalSeconds, 0);
  return {
    totalSeconds,
    dailyAverageSeconds: days.length ? totalSeconds / days.length : 0,
    activeDays: days.filter((day) => day.totalSeconds > 0).length,
  };
}

function normalizedName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name ? name.slice(0, 80) : null;
}

function aggregateBreakdown(
  days: IParsedDay[],
  key: 'languages' | 'editors',
): IWakaTimeBreakdownItem[] {
  const grouped = new Map<string, { name: string; seconds: number }>();
  for (const day of days) {
    for (const raw of day[key]) {
      const item = asRecord(raw);
      const name = normalizedName(item?.name);
      const seconds = nonNegative(item?.total_seconds);
      if (!name || seconds === null || seconds <= 0) continue;
      const id = name.toLocaleLowerCase('en-US');
      const current = grouped.get(id);
      grouped.set(id, {
        name: current?.name ?? name,
        seconds: (current?.seconds ?? 0) + seconds,
      });
    }
  }
  const sorted = [...grouped.values()].sort(
    (a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name),
  );
  const total = sorted.reduce((sum, item) => sum + item.seconds, 0);
  if (!total) return [];
  const visible = sorted.slice(0, 3);
  const otherSeconds = sorted
    .slice(3)
    .reduce((sum, item) => sum + item.seconds, 0);
  if (otherSeconds > 0) visible.push({ name: '其他', seconds: otherSeconds });
  return visible.map((item) => ({ ...item, share: item.seconds / total }));
}

function sumOptional(days: IParsedDay[], field: string): number | null {
  const values = days
    .map((day) => nonNegative(day.grand[field]))
    .filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function aggregateChanges(
  days: IParsedDay[],
): { ai: number; human: number } | null {
  const relevantDays = days.filter((day) => day.totalSeconds > 0);
  if (
    relevantDays.length === 0 ||
    relevantDays.some((day) => day.changes === null)
  ) {
    return null;
  }
  return relevantDays.reduce(
    (total, day) => ({
      ai: total.ai + (day.changes?.ai ?? 0),
      human: total.human + (day.changes?.human ?? 0),
    }),
    { ai: 0, human: 0 },
  );
}

function promptsPerSession(days: IParsedDay[]): number | null {
  let sessions = 0;
  let promptEvents = 0;
  let hasCoverage = false;
  for (const day of days) {
    const daySessions = nonNegative(day.grand.ai_sessions);
    const dayPromptEvents = nonNegative(day.grand.ai_prompt_events_total);
    if (daySessions === null && dayPromptEvents === null) continue;
    if (daySessions === null || dayPromptEvents === null) return null;
    hasCoverage = true;
    sessions += daySessions;
    promptEvents += dayPromptEvents;
  }
  return hasCoverage && sessions > 0 ? promptEvents / sessions : null;
}

function aggregateModels(days: IParsedDay[]): IWakaTimeAiModel[] {
  const grouped = new Map<
    string,
    { name: string; changes: number; cost: number; hasCost: boolean }
  >();
  for (const day of days) {
    const breakdown = Array.isArray(day.grand.ai_model_breakdown)
      ? day.grand.ai_model_breakdown
      : [];
    for (const raw of breakdown) {
      const item = asRecord(raw);
      const name = normalizedName(item?.name);
      const changes = nonNegative(item?.lines);
      const cost = nonNegative(item?.cost);
      if (!name || changes === null) continue;
      const id = name.toLocaleLowerCase('en-US');
      const current = grouped.get(id);
      grouped.set(id, {
        name: current?.name ?? name,
        changes: (current?.changes ?? 0) + changes,
        cost: (current?.cost ?? 0) + (cost ?? 0),
        hasCost: Boolean(current?.hasCost || cost !== null),
      });
    }
  }
  const sorted = [...grouped.values()]
    .sort((a, b) => b.changes - a.changes || a.name.localeCompare(b.name))
    .slice(0, 3);
  const total = [...grouped.values()].reduce(
    (sum, item) => sum + item.changes,
    0,
  );
  return sorted.map((item) => ({
    name: item.name,
    changes: item.changes,
    share: total > 0 ? item.changes / total : 0,
    estimatedCostUsd: item.hasCost ? item.cost : null,
  }));
}

/** 将 WakaTime unknown payload 逐字段归一为公开白名单 DTO。 */
export function buildWakaTimeLandingStats(
  payload: unknown,
  timeZone: string,
  requestedRange: { startDate: string; endDate: string },
  now = new Date(),
): IWakaTimeLandingStats {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.data))
    throw new WakaTimePayloadSchemaError();
  const byDate = new Map<string, IParsedDay>();
  for (const raw of root.data) {
    const day = parseDay(raw);
    if (
      day &&
      day.date >= requestedRange.startDate &&
      day.date <= requestedRange.endDate
    ) {
      byDate.set(day.date, day);
    }
  }
  if (byDate.size === 0) throw new WakaTimePayloadSchemaError();

  const parsedDays: IParsedDay[] = [];
  for (
    let date = requestedRange.startDate;
    date <= requestedRange.endDate;
    date = addWakaTimeCalendarDays(date, 1)
  ) {
    parsedDays.push(
      byDate.get(date) ?? {
        date,
        totalSeconds: 0,
        changes: null,
        grand: {},
        languages: [],
        editors: [],
      },
    );
  }
  const days: IWakaTimeDayStats[] = parsedDays.map((day) => ({
    date: day.date,
    totalSeconds: day.totalSeconds,
    aiChangeShare: aiShare(day.changes),
  }));
  const changes = aggregateChanges(parsedDays);
  const changes7Days = aggregateChanges(parsedDays.slice(-7));
  const sessions = sumOptional(parsedDays, 'ai_sessions');
  const promptEvents = sumOptional(parsedDays, 'ai_prompt_events_total');
  const estimatedCostUsd = sumOptional(parsedDays, 'ai_model_total_cost');
  const input = sumOptional(parsedDays, 'ai_input_tokens');
  const cachedInput = sumOptional(parsedDays, 'ai_cached_input_tokens');
  const output = sumOptional(parsedDays, 'ai_output_tokens');
  const models = aggregateModels(parsedDays);
  const hasAi = Boolean(
    changes ||
      sessions !== null ||
      promptEvents !== null ||
      estimatedCostUsd !== null ||
      input !== null ||
      cachedInput !== null ||
      output !== null ||
      models.length,
  );

  return {
    range: { ...requestedRange, timeZone },
    summary30Days: buildPeriod(parsedDays),
    summary7Days: buildPeriod(parsedDays.slice(-7)),
    days,
    languages: aggregateBreakdown(parsedDays, 'languages'),
    editors: aggregateBreakdown(parsedDays, 'editors'),
    ai: hasAi
      ? {
          changeShare: aiShare(changes),
          changeShare7Days: aiShare(changes7Days),
          aiChanges: changes?.ai ?? null,
          humanChanges: changes?.human ?? null,
          tokens: { input, cachedInput, output },
          estimatedCostUsd,
          sessions,
          promptEvents,
          promptsPerSession: promptsPerSession(parsedDays),
          models,
        }
      : null,
    fetchedAt: now.toISOString(),
    stale: false,
  };
}
