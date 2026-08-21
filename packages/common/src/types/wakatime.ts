export interface IWakaTimePeriodSummary {
  totalSeconds: number;
  dailyAverageSeconds: number;
  activeDays: number;
}

export interface IWakaTimeDayStats {
  date: string;
  totalSeconds: number;
  /** AI additions/deletions 占全部 AI + human 行变更的比例；缺失/无分母时为 null。 */
  aiChangeShare: number | null;
}

export interface IWakaTimeBreakdownItem {
  name: string;
  seconds: number;
  share: number;
}

export interface IWakaTimeAiModel {
  name: string;
  changes: number;
  share: number;
  estimatedCostUsd: number | null;
}

export interface IWakaTimeAiStats {
  changeShare: number | null;
  /** 最近七个自然日的 AI 行变更占比，口径与 30 天值一致。 */
  changeShare7Days: number | null;
  aiChanges: number | null;
  humanChanges: number | null;
  tokens: {
    input: number | null;
    cachedInput: number | null;
    output: number | null;
  };
  /** WakaTime 估算值，不是真实供应商账单。 */
  estimatedCostUsd: number | null;
  sessions: number | null;
  promptEvents: number | null;
  promptsPerSession: number | null;
  models: IWakaTimeAiModel[];
}

/**
 * Landing 唯一可公开的 WakaTime 白名单快照。
 * 该类型故意无法表达 project/repository/branch/path/machine/raw UA/session/account/credential。
 */
export interface IWakaTimeLandingStats {
  range: {
    startDate: string;
    endDate: string;
    timeZone: string;
  };
  summary30Days: IWakaTimePeriodSummary;
  summary7Days: IWakaTimePeriodSummary;
  days: IWakaTimeDayStats[];
  languages: IWakaTimeBreakdownItem[];
  editors: IWakaTimeBreakdownItem[];
  ai: IWakaTimeAiStats | null;
  fetchedAt: string;
  stale: boolean;
}
