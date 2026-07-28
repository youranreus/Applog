export const DUOLINGO_BASE_URL = 'https://www.duolingo.com';
export const DUOLINGO_USER_AGENT = 'Duolingo/7.41.4 (Android; 10; SM-G960F)';
export const DUOLINGO_HTTP_TIMEOUT_MS = 15_000;
export const DUOLINGO_HTTP_RETRY_DELAY_MS = 250;
export const DUOLINGO_SUCCESS_CACHE_TTL_MS = 30 * 60 * 1000;
export const DUOLINGO_FAILURE_CACHE_TTL_MS = 60 * 1000;

export const DUOLINGO_LEAGUE_NAMES = [
  '青铜',
  '白银',
  '黄金',
  '蓝宝石',
  '红宝石',
  '祖母绿',
  '紫水晶',
  '珍珠',
  '黑曜石',
  '钻石',
] as const;
