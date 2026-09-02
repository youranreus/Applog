import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  buildTokscaleLandingStats,
  TokscalePayloadSchemaError,
} from '../src/module/tokscale/tokscale.utils';

function fixture(): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures/tokscale-profile.json'), 'utf8'),
  ) as unknown;
}

function contribution(date: string, tokens: number, cost = 1) {
  return {
    date,
    totals: { tokens, cost, messages: 0 },
    tokenBreakdown: {
      input: tokens,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
    },
    clients: [],
  };
}

describe('Tokscale normalizer', () => {
  it('用 fixture 选择最后一个有 token 的日子并跳过尾部零 token 日', () => {
    const raw = fixture() as {
      contributions: Array<{ date: string; totals: { tokens: number } }>;
    };
    const stats = buildTokscaleLandingStats(
      raw,
      new Date('2026-09-02T12:00:00Z'),
    );
    const positiveDates = raw.contributions
      .filter((day) => day.totals?.tokens > 0)
      .map((day) => day.date)
      .sort();
    assert.equal(stats.date, positiveDates.at(-1));
    assert.equal(
      stats.totalTokens,
      stats.tokens.input +
        stats.tokens.output +
        stats.tokens.cacheRead +
        stats.tokens.cacheWrite +
        stats.tokens.reasoning,
    );
    assert.equal(JSON.stringify(stats).includes('<synthetic>'), false);
  });

  it('公开 DTO 不转发 profile 中与区块无关的字段', () => {
    const stats = buildTokscaleLandingStats(fixture());
    const publicJson = JSON.stringify(stats);
    for (const forbidden of [
      'avatarUrl',
      'rank',
      'mcpServers',
      'sessionCount',
      'devices',
      'user',
      'id":"user',
    ]) {
      assert.equal(publicJson.includes(forbidden), false);
    }
  });

  it('软件和模型按 cost 降序稳定排序，且模型合计与软件 totals 一致', () => {
    const stats = buildTokscaleLandingStats(fixture());
    const clientCosts = stats.clients.map((client) => client.cost);
    assert.deepEqual(
      clientCosts,
      [...clientCosts].sort((a, b) => b - a),
    );
    for (const client of stats.clients) {
      const modelCosts = client.models.map((model) => model.cost);
      assert.deepEqual(
        modelCosts,
        [...modelCosts].sort((a, b) => b - a),
      );
      if (!client.models.length) continue;
      const modelTokens = client.models.reduce(
        (sum, model) => sum + model.tokens,
        0,
      );
      const modelCost = client.models.reduce(
        (sum, model) => sum + model.cost,
        0,
      );
      assert.equal(modelTokens, client.tokens);
      assert.ok(Math.abs(modelCost - client.cost) < 0.000001);
    }
  });

  it('models 为空但 modelId 非空时用软件 totals 合成模型行，未知软件 id 原样显示', () => {
    const stats = buildTokscaleLandingStats({
      updatedAt: null,
      contributions: [
        {
          date: '2026-09-02',
          totals: { tokens: 12, cost: 0.2, messages: 0 },
          tokenBreakdown: {
            input: 12,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            reasoning: 0,
          },
          clients: [
            {
              client: 'unknown-client',
              modelId: 'legacy-model',
              models: {},
              tokens: {
                input: 10,
                output: 2,
                cacheRead: 0,
                cacheWrite: 0,
                reasoning: 0,
              },
              cost: 0.2,
            },
          ],
        },
      ],
    });
    assert.equal(stats.clients[0].name, 'unknown-client');
    assert.deepEqual(stats.clients[0].models[0], {
      model: 'legacy-model',
      tokens: 12,
      cost: 0.2,
      input: 10,
      output: 2,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
    });
  });

  it('contributions 非数组或全零时抛 schema error', () => {
    assert.throws(
      () => buildTokscaleLandingStats({}),
      TokscalePayloadSchemaError,
    );
    assert.throws(
      () =>
        buildTokscaleLandingStats({
          contributions: [contribution('2026-09-01', 0, 0)],
        }),
      TokscalePayloadSchemaError,
    );
  });

  it('不依赖上游顺序，按 date 升序后取最后有数据的自然日', () => {
    const stats = buildTokscaleLandingStats({
      contributions: [
        contribution('2026-09-03', 0, 0),
        contribution('2026-09-01', 10, 0.1),
        contribution('2026-09-02', 20, 0.2),
      ],
    });
    assert.equal(stats.date, '2026-09-02');
    assert.equal(stats.totalCost, 0.2);
  });
});
