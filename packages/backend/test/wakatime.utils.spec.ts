import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildWakaTimeLandingStats,
  getWakaTimeDateRange,
  WakaTimePayloadSchemaError,
} from '../src/module/wakatime/wakatime.utils';

function day(
  date: string,
  seconds: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    range: { date },
    grand_total: {
      total_seconds: seconds,
      ai_additions: 2,
      ai_deletions: 1,
      human_additions: 5,
      human_deletions: 2,
      ai_input_tokens: 10,
      ai_cached_input_tokens: 20,
      ai_output_tokens: 5,
      ai_model_total_cost: 0.25,
      ai_sessions: 2,
      ai_prompt_events_total: 4,
      ai_model_breakdown: [{ name: 'Opus', lines: 3, cost: 0.25 }],
      ...overrides,
    },
    languages: [{ name: 'TypeScript', total_seconds: seconds }],
    editors: [{ name: 'Cursor', total_seconds: seconds }],
  };
}

describe('WakaTime normalizer', () => {
  it('用 additions/deletions 四元组计算 AI 占比，并保持 token/成本类型', () => {
    const data = [day('2026-08-20', 3600), day('2026-08-21', 1800)];
    const stats = buildWakaTimeLandingStats(
      { data },
      'Asia/Shanghai',
      { startDate: '2026-08-20', endDate: '2026-08-21' },
      new Date('2026-08-21T12:00:00Z'),
    );
    assert.equal(stats.summary30Days.totalSeconds, 5400);
    assert.equal(stats.summary30Days.activeDays, 2);
    assert.equal(stats.ai?.changeShare, 3 / 10);
    assert.equal(stats.ai?.changeShare7Days, 3 / 10);
    assert.deepEqual(stats.ai?.tokens, {
      input: 20,
      cachedInput: 40,
      output: 10,
    });
    assert.equal(stats.ai?.estimatedCostUsd, 0.5);
    assert.equal(stats.ai?.promptsPerSession, 2);
    assert.equal(stats.languages[0].name, 'TypeScript');
    assert.equal(stats.editors[0].name, 'Cursor');
  });

  it('缺失 AI 四元组或分母为 0 时返回 null，成本 0 仍为真实值', () => {
    const missing = day('2026-08-21', 0, {
      ai_additions: undefined,
      ai_deletions: 0,
      human_additions: 0,
      human_deletions: 0,
      ai_model_total_cost: 0,
    });
    const stats = buildWakaTimeLandingStats({ data: [missing] }, 'UTC', {
      startDate: '2026-08-21',
      endDate: '2026-08-21',
    });
    assert.equal(stats.days[0].aiChangeShare, null);
    assert.equal(stats.ai?.changeShare, null);
    assert.equal(stats.ai?.estimatedCostUsd, 0);
  });

  it('拒绝 numeric string，并且不从错位的 session/prompt 覆盖推断互动比率', () => {
    const sessionsOnly = day('2026-08-20', 60, {
      ai_input_tokens: '10',
      ai_sessions: 2,
      ai_prompt_events_total: undefined,
    });
    const promptsOnly = day('2026-08-21', 60, {
      ai_sessions: undefined,
      ai_prompt_events_total: 4,
    });
    const stats = buildWakaTimeLandingStats(
      { data: [sessionsOnly, promptsOnly] },
      'UTC',
      { startDate: '2026-08-20', endDate: '2026-08-21' },
    );
    assert.equal(stats.summary30Days.totalSeconds, 120);
    assert.equal(stats.ai?.tokens.input, 10);
    assert.equal(stats.ai?.sessions, 2);
    assert.equal(stats.ai?.promptEvents, 4);
    assert.equal(stats.ai?.promptsPerSession, null);
  });

  it('7 天窗口按最后七个自然日加权，并将 Top 3 之外的语言合并为其他', () => {
    const data = Array.from({ length: 8 }, (_, index) => {
      const value = day(
        `2026-08-${String(14 + index).padStart(2, '0')}`,
        index ? 10 : 100,
        {
          ai_additions: index ? 0 : 100,
          ai_deletions: 0,
          human_additions: index ? 10 : 0,
          human_deletions: 0,
        },
      );
      if (index === 0) {
        value.languages = [
          { name: 'TypeScript', total_seconds: 40 },
          { name: 'Vue', total_seconds: 30 },
          { name: 'SCSS', total_seconds: 20 },
          { name: 'Shell', total_seconds: 10 },
        ];
      }
      return value;
    });
    const stats = buildWakaTimeLandingStats({ data }, 'UTC', {
      startDate: '2026-08-14',
      endDate: '2026-08-21',
    });
    assert.equal(stats.summary30Days.totalSeconds, 170);
    assert.equal(stats.summary7Days.totalSeconds, 70);
    assert.equal(stats.ai?.changeShare, 100 / 170);
    assert.equal(stats.ai?.changeShare7Days, 0);
    assert.deepEqual(
      stats.languages.map((item) => item.name),
      ['TypeScript', 'Vue', 'SCSS', '其他'],
    );
  });

  it('成本字段完全缺失时保持 null，不伪装成零成本', () => {
    const value = day('2026-08-21', 60, {
      ai_model_total_cost: undefined,
    });
    const stats = buildWakaTimeLandingStats({ data: [value] }, 'UTC', {
      startDate: '2026-08-21',
      endDate: '2026-08-21',
    });
    assert.equal(stats.ai?.estimatedCostUsd, null);
  });

  it('拒绝无 data 数组的 schema，时区日期范围为含首尾 30 天', () => {
    assert.throws(
      () =>
        buildWakaTimeLandingStats({}, 'UTC', {
          startDate: '2026-01-01',
          endDate: '2026-01-30',
        }),
      WakaTimePayloadSchemaError,
    );
    assert.deepEqual(
      getWakaTimeDateRange('Asia/Shanghai', new Date('2026-08-21T12:00:00Z')),
      { startDate: '2026-07-23', endDate: '2026-08-21' },
    );
  });

  it('公开 DTO 不会转发项目、文件、机器、session 或凭证', () => {
    const secret = 'never-public';
    const raw = day('2026-08-21', 60) as Record<string, unknown>;
    Object.assign(raw, {
      projects: [{ name: secret }],
      repository: secret,
      dependencies: [{ name: secret }],
      machines: [{ name: secret }],
      entity: secret,
      path: secret,
      branch: secret,
      ai_session: secret,
      user_agent: secret,
      account: secret,
      plan: secret,
      api_key: secret,
    });
    const stats = buildWakaTimeLandingStats({ data: [raw] }, 'UTC', {
      startDate: '2026-08-21',
      endDate: '2026-08-21',
    });
    const publicJson = JSON.stringify(stats);
    assert.equal(publicJson.includes(secret), false);
    for (const forbidden of [
      'projects',
      'repository',
      'dependencies',
      'machines',
      'entity',
      'path',
      'branch',
      'ai_session',
      'user_agent',
      'account',
      'plan',
      'api_key',
    ]) {
      assert.equal(publicJson.includes(forbidden), false);
    }
  });
});
