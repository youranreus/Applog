export interface IDuolingoLeague {
  tier: number;
  name: string;
}

export interface IDuolingoDailyStats {
  date: string;
  xp: number;
  learningSeconds: number | null;
}

export interface IDuolingoLanguageStats {
  code: string;
  name: string;
  xp: number;
  /** 以全部有效语言 XP 为分母，范围 0..1 */
  share: number;
}

export interface IDuolingoYearDay {
  date: string;
  /** 未来日期为 null；已发生但无 summary 的日期为 0 */
  xp: number | null;
  future: boolean;
}

/**
 * Landing 唯一可公开的 Duolingo 聚合契约。
 * 不包含用户名、userId、JWT 或第三方原始对象。
 */
export interface IDuolingoLandingStats {
  streakDays: number | null;
  league: IDuolingoLeague | null;
  last7Days: {
    totalXp: number;
    totalLearningSeconds: number | null;
    days: IDuolingoDailyStats[];
  };
  languages: IDuolingoLanguageStats[];
  yearlyXp: {
    year: number;
    days: IDuolingoYearDay[];
  };
  fetchedAt: string;
  stale: boolean;
}
