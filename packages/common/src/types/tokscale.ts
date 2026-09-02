/** 某软件下单个模型的当日用量。 */
export interface ITokscaleModelUsage {
  /** 上游模型 id，如 gpt-5.6-terra */
  model: string;
  tokens: number;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}

/** 单个 AI 软件的当日用量及模型明细。 */
export interface ITokscaleClientUsage {
  /** 上游客户端 id，如 pi / cursor */
  id: string;
  /** 展示名；未知 id 时等于 id */
  name: string;
  tokens: number;
  cost: number;
  models: ITokscaleModelUsage[];
}

/** Landing 公开快照：过去一天的 AI token 用量。 */
export interface ITokscaleLandingStats {
  /** 数据所属自然日 YYYY-MM-DD（按提交机本地时区分桶） */
  date: string;
  /** 该日总 token，等于 tokens 五项之和 */
  totalTokens: number;
  /** 该日估算成本（USD） */
  totalCost: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
  };
  /** 按 cost 降序的软件列表；组内模型同样按 cost 降序 */
  clients: ITokscaleClientUsage[];
  /** 上游最近一次 submit 时间（ISO），可为 null */
  updatedAt: string | null;
  /** Applog 抓取快照的时间（ISO） */
  fetchedAt: string;
  /** 快照已过成功 TTL 且刷新失败 */
  stale: boolean;
}
