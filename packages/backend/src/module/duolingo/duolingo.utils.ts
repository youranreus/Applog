import type {
  IDuolingoDailyStats,
  IDuolingoLandingStats,
  IDuolingoLanguageStats,
  IDuolingoLeague,
  IDuolingoYearDay,
} from '@applog/common';
import { DUOLINGO_LEAGUE_NAMES } from './duolingo.constants';

type UnknownRecord = Record<string, unknown>;

interface IParsedSummary {
  date: string;
  xp: number;
  learningSeconds: number | null;
}

export class DuolingoPayloadSchemaError extends Error {
  constructor(section: 'user' | 'summaries') {
    super(`Duolingo ${section} payload schema mismatch`);
    this.name = 'DuolingoPayloadSchemaError';
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNonNegativeInteger(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(numeric) || numeric < 0) return null;
  return numeric;
}

function getAliased(record: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

/**
 * 使用 UTC Date 仅进行日历键运算，不表达展示时区。
 */
export function addCalendarDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

/**
 * 将时刻按 IANA 时区转换成日历日期键。
 */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
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

/**
 * 解析 summary 日期。纯日历字符串不做时区转换；Unix 秒才转换。
 */
export function parseDuolingoDateKey(
  value: unknown,
  timeZone: string,
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(trimmed);
    if (match) return match[1];
    if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
    value = Number(trimmed);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime())
    ? null
    : dateKeyInTimeZone(date, timeZone);
}

function extractSummaries(
  payload: unknown,
  timeZone: string,
): IParsedSummary[] | null {
  const root = asRecord(payload);
  const raw = Array.isArray(payload)
    ? payload
    : root && Array.isArray(root.summaries)
      ? root.summaries
      : null;
  if (!raw) return null;
  const result: IParsedSummary[] = [];

  for (const item of raw) {
    const summary = asRecord(item);
    if (!summary) continue;
    const date = parseDuolingoDateKey(summary.date, timeZone);
    if (!date) continue;
    const xp =
      toNonNegativeInteger(getAliased(summary, 'gainedXp', 'gained_xp')) ?? 0;
    const rawDuration = getAliased(
      summary,
      'totalSessionTime',
      'total_session_time',
    );
    result.push({
      date,
      xp,
      learningSeconds:
        rawDuration === undefined ? null : toNonNegativeInteger(rawDuration),
    });
  }
  if (raw.length > 0 && result.length === 0) return null;
  return result;
}

function aggregateSummaries(
  summaries: IParsedSummary[],
): Map<string, { xp: number; learningSeconds: number | null }> {
  const result = new Map<
    string,
    { xp: number; learningSeconds: number | null }
  >();
  for (const summary of summaries) {
    const current = result.get(summary.date);
    result.set(summary.date, {
      xp: (current?.xp ?? 0) + summary.xp,
      learningSeconds:
        current?.learningSeconds === null || summary.learningSeconds === null
          ? null
          : (current?.learningSeconds ?? 0) + summary.learningSeconds,
    });
  }
  return result;
}

/**
 * 解析 Duolingo 连胜，只接受非负有限整数。
 */
export function parseDuolingoStreak(payload: unknown): number | null {
  const user = asRecord(payload);
  if (!user) return null;
  return toNonNegativeInteger(getAliased(user, 'site_streak', 'streak'));
}

function findTier(payload: UnknownRecord): unknown {
  const tracking =
    asRecord(payload.trackingProperties) ??
    asRecord(payload.tracking_properties);
  const direct = getAliased(payload, 'tier');
  if (direct !== undefined) return direct;
  const tracked = tracking
    ? getAliased(tracking, 'league_tier', 'leaderboard_league')
    : undefined;
  if (tracked !== undefined) return tracked;

  const languageData =
    asRecord(payload.language_data) ?? asRecord(payload.languageData);
  if (!languageData) return undefined;
  for (const value of Object.values(languageData)) {
    const record = asRecord(value);
    const isCurrent =
      record?.current_learning === true || record?.currentLearning === true;
    if (isCurrent && record.tier !== undefined) return record.tier;
  }
  return undefined;
}

/**
 * 解析联赛段位。tier 严格限定 0..9。
 */
export function parseDuolingoLeague(payload: unknown): IDuolingoLeague | null {
  const user = asRecord(payload);
  if (!user) return null;
  const tier = toNonNegativeInteger(findTier(user));
  if (tier === null || tier >= DUOLINGO_LEAGUE_NAMES.length) return null;
  return { tier, name: DUOLINGO_LEAGUE_NAMES[tier] };
}

const NON_LANGUAGE_VALUES = new Set([
  'math',
  'mathematics',
  'music',
  '数学',
  '音乐',
]);

function isNonLanguageCourse(course: UnknownRecord, code: string): boolean {
  const subject = String(
    getAliased(course, 'subject', 'courseType', 'course_type') ?? '',
  )
    .trim()
    .toLocaleLowerCase('en-US');
  return NON_LANGUAGE_VALUES.has(subject) || NON_LANGUAGE_VALUES.has(code);
}

function displayLanguageName(code: string, fallback: string): string {
  try {
    const resolved = new Intl.DisplayNames(['zh-CN'], {
      type: 'language',
    }).of(code);
    if (resolved && resolved !== code) return resolved;
  } catch {
    // 非标准语言码回退课程标题或原码。
  }
  return fallback || code;
}

/**
 * 按目标语言聚合累计 XP，以全部语言 XP 为分母后取前两项。
 */
export function parseDuolingoLanguages(
  payload: unknown,
): IDuolingoLanguageStats[] {
  const user = asRecord(payload);
  if (!user) return [];
  const courses = asArray(getAliased(user, 'courses', 'courseList'));
  const grouped = new Map<string, { xp: number; title: string }>();

  for (const item of courses) {
    const course = asRecord(item);
    if (!course) continue;
    const code = String(
      getAliased(course, 'learningLanguage', 'learning_language') ?? '',
    )
      .trim()
      .toLocaleLowerCase('en-US');
    const xp = toNonNegativeInteger(course.xp) ?? 0;
    if (!code || xp <= 0 || isNonLanguageCourse(course, code)) continue;
    const title = typeof course.title === 'string' ? course.title.trim() : '';
    const current = grouped.get(code);
    grouped.set(code, {
      xp: (current?.xp ?? 0) + xp,
      title: current?.title || title,
    });
  }

  const totalXp = [...grouped.values()].reduce((sum, item) => sum + item.xp, 0);
  if (totalXp <= 0) return [];
  return [...grouped.entries()]
    .map(([code, value]) => ({
      code,
      name: displayLanguageName(code, value.title),
      xp: value.xp,
      share: value.xp / totalXp,
    }))
    .sort((a, b) => b.xp - a.xp || a.code.localeCompare(b.code))
    .slice(0, 2);
}

function buildLast7Days(
  aggregated: Map<string, { xp: number; learningSeconds: number | null }>,
  today: string,
): IDuolingoLandingStats['last7Days'] {
  const days: IDuolingoDailyStats[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const date = addCalendarDays(today, offset);
    const summary = aggregated.get(date);
    days.push({
      date,
      xp: summary?.xp ?? 0,
      learningSeconds: summary ? summary.learningSeconds : 0,
    });
  }
  const totalLearningSeconds = days.some((day) => day.learningSeconds === null)
    ? null
    : days.reduce((sum, day) => sum + (day.learningSeconds ?? 0), 0);
  return {
    totalXp: days.reduce((sum, day) => sum + day.xp, 0),
    totalLearningSeconds,
    days,
  };
}

function buildYearlyXp(
  aggregated: Map<string, { xp: number; learningSeconds: number | null }>,
  today: string,
): IDuolingoLandingStats['yearlyXp'] {
  const year = Number(today.slice(0, 4));
  const first = `${year}-01-01`;
  const nextYear = `${year + 1}-01-01`;
  const days: IDuolingoYearDay[] = [];
  for (let date = first; date < nextYear; date = addCalendarDays(date, 1)) {
    const future = date > today;
    days.push({
      date,
      xp: future ? null : (aggregated.get(date)?.xp ?? 0),
      future,
    });
  }
  return { year, days };
}

/**
 * 将两个第三方 unknown payload 归一成稳定 Landing DTO。
 */
export function buildDuolingoLandingStats(
  userPayload: unknown,
  summariesPayload: unknown,
  timeZone: string,
  now = new Date(),
): IDuolingoLandingStats {
  if (!asRecord(userPayload)) {
    throw new DuolingoPayloadSchemaError('user');
  }
  const today = dateKeyInTimeZone(now, timeZone);
  const summaries = extractSummaries(summariesPayload, timeZone);
  if (!summaries) {
    throw new DuolingoPayloadSchemaError('summaries');
  }
  const aggregated = aggregateSummaries(summaries);
  return {
    streakDays: parseDuolingoStreak(userPayload),
    league: parseDuolingoLeague(userPayload),
    last7Days: buildLast7Days(aggregated, today),
    languages: parseDuolingoLanguages(userPayload),
    yearlyXp: buildYearlyXp(aggregated, today),
    fetchedAt: now.toISOString(),
    stale: false,
  };
}

/**
 * 计算 XP summaries 请求起点，兼顾跨年 7 日窗口。
 */
export function getDuolingoSummaryStartDate(
  timeZone: string,
  now = new Date(),
): string {
  const today = dateKeyInTimeZone(now, timeZone);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const rollingStart = addCalendarDays(today, -6);
  return rollingStart < yearStart ? rollingStart : yearStart;
}
