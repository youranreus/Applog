import type {
  ITokscaleClientUsage,
  ITokscaleLandingStats,
  ITokscaleModelUsage,
} from '@applog/common';
import { TOKSCALE_CLIENT_DISPLAY_NAMES } from '@applog/common';

type UnknownRecord = Record<string, unknown>;
type TokenBreakdown = ITokscaleLandingStats['tokens'];

interface IParsedClient {
  id: string;
  name: string;
  tokens: number;
  cost: number;
  models: ITokscaleModelUsage[];
  order: number;
}

export class TokscalePayloadSchemaError extends Error {
  constructor() {
    super('Tokscale profile schema');
    this.name = 'TokscalePayloadSchemaError';
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function nonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function normalizedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function parseTokens(value: unknown): TokenBreakdown {
  const record = asRecord(value) ?? {};
  return {
    input: nonNegative(record.input),
    output: nonNegative(record.output),
    cacheRead: nonNegative(record.cacheRead),
    cacheWrite: nonNegative(record.cacheWrite),
    reasoning: nonNegative(record.reasoning),
  };
}

function sumTokens(tokens: TokenBreakdown): number {
  return (
    tokens.input +
    tokens.output +
    tokens.cacheRead +
    tokens.cacheWrite +
    tokens.reasoning
  );
}

function modelUsage(model: string, raw: unknown): ITokscaleModelUsage | null {
  const id = model.trim();
  if (!id || id === '<synthetic>') return null;
  const record = asRecord(raw) ?? {};
  const tokens = parseTokens(record);
  return {
    model: id,
    tokens: nonNegative(record.tokens) || sumTokens(tokens),
    cost: nonNegative(record.cost),
    ...tokens,
  };
}

function sortUsage<T extends { cost: number; tokens: number }>(
  items: Array<T & { name?: string; model?: string; order?: number }>,
): T[] {
  return [...items].sort((left, right) => {
    const leftName = left.name ?? left.model ?? '';
    const rightName = right.name ?? right.model ?? '';
    return (
      right.cost - left.cost ||
      right.tokens - left.tokens ||
      leftName.localeCompare(rightName) ||
      (left.order ?? 0) - (right.order ?? 0)
    );
  });
}

function parseModels(
  client: UnknownRecord,
  tokens: TokenBreakdown,
): ITokscaleModelUsage[] {
  const rawModels = asRecord(client.models);
  const models: ITokscaleModelUsage[] = [];
  if (rawModels) {
    for (const [model, raw] of Object.entries(rawModels)) {
      const parsed = modelUsage(model, raw);
      if (parsed) models.push(parsed);
    }
  }

  const fallbackModelId = normalizedText(client.modelId);
  if (!models.length && fallbackModelId && fallbackModelId !== '<synthetic>') {
    models.push({
      model: fallbackModelId,
      tokens: sumTokens(tokens),
      cost: nonNegative(client.cost),
      ...tokens,
    });
  }
  return sortUsage(models);
}

function parseClient(raw: unknown, order: number): IParsedClient | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = normalizedText(record.client);
  if (!id) return null;
  const tokens = parseTokens(record.tokens);
  const cost = nonNegative(record.cost);
  return {
    id,
    name: TOKSCALE_CLIENT_DISPLAY_NAMES[id] ?? id,
    tokens: sumTokens(tokens),
    cost,
    models: parseModels(record, tokens),
    order,
  };
}

/** 将 Tokscale unknown profile 逐字段归一为 Landing 公开白名单 DTO。 */
export function buildTokscaleLandingStats(
  payload: unknown,
  now = new Date(),
): ITokscaleLandingStats {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.contributions)) {
    throw new TokscalePayloadSchemaError();
  }

  const contributions = root.contributions
    .map((value) => asRecord(value))
    .filter((value): value is UnknownRecord => Boolean(value))
    .sort((left, right) =>
      normalizedText(left.date).localeCompare(normalizedText(right.date)),
    );
  const selected = [...contributions].reverse().find((day) => {
    const totals = asRecord(day.totals);
    return dateKey(day.date) && nonNegative(totals?.tokens) > 0;
  });
  if (!selected) throw new TokscalePayloadSchemaError();

  const totals = asRecord(selected.totals) ?? {};
  const tokens = parseTokens(selected.tokenBreakdown);
  const rawClients = Array.isArray(selected.clients) ? selected.clients : [];
  const clients = sortUsage(
    rawClients
      .map((client, index) => parseClient(client, index))
      .filter((client): client is IParsedClient => Boolean(client)),
  ).map<ITokscaleClientUsage>((client) => ({
    id: client.id,
    name: client.name,
    tokens: client.tokens,
    cost: client.cost,
    models: client.models,
  }));
  const updatedAt =
    typeof root.updatedAt === 'string'
      ? root.updatedAt
      : root.updatedAt === null
        ? null
        : null;

  return {
    date: dateKey(selected.date) ?? '',
    totalTokens: nonNegative(totals.tokens),
    totalCost: nonNegative(totals.cost),
    tokens,
    clients,
    updatedAt,
    fetchedAt: now.toISOString(),
    stale: false,
  };
}
