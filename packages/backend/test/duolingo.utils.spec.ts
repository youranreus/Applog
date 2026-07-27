import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  DUOLINGO_JWT_MASK,
  isDuolingoConfigured,
  isValidIanaTimeZone,
  maskDuolingoConfigJwt,
  shouldKeepExistingDuolingoJwt,
} from '@applog/common';
import {
  buildDuolingoLandingStats,
  getDuolingoSummaryStartDate,
  parseDuolingoDateKey,
  parseDuolingoLanguages,
  parseDuolingoLeague,
  parseDuolingoStreak,
} from '../src/module/duolingo/duolingo.utils';

describe('Duolingo config helpers', () => {
  it('脱敏 JWT，并将空值和占位提交都视为保留旧凭证', () => {
    assert.deepEqual(
      maskDuolingoConfigJwt({
        username: '  learner ',
        jwt: 'secret-token',
        timeZone: 'Asia/Shanghai',
        enabled: true,
      }),
      {
        username: 'learner',
        jwt: DUOLINGO_JWT_MASK,
        timeZone: 'Asia/Shanghai',
        enabled: true,
      },
    );
    assert.equal(shouldKeepExistingDuolingoJwt(''), true);
    assert.equal(shouldKeepExistingDuolingoJwt(DUOLINGO_JWT_MASK), true);
    assert.equal(shouldKeepExistingDuolingoJwt('new-token'), false);
  });

  it('启用判定要求用户名、JWT 与合法 IANA 时区齐备', () => {
    assert.equal(isValidIanaTimeZone('Asia/Shanghai'), true);
    assert.equal(isValidIanaTimeZone('Mars/Olympus'), false);
    assert.equal(
      isDuolingoConfigured({
        username: 'learner',
        jwt: 'token',
        timeZone: 'Asia/Shanghai',
        enabled: true,
      }),
      true,
    );
    assert.equal(
      isDuolingoConfigured({
        username: 'learner',
        jwt: 'token',
        timeZone: 'Mars/Olympus',
        enabled: true,
      }),
      false,
    );
  });
});

describe('Duolingo response normalization', () => {
  it('关键第三方 payload 结构漂移时拒绝伪装成全零成功快照', () => {
    assert.throws(() =>
      buildDuolingoLandingStats(
        {},
        {},
        'Asia/Shanghai',
        new Date('2026-07-27T04:00:00.000Z'),
      ),
    );
    assert.throws(() =>
      buildDuolingoLandingStats(
        {},
        { summaries: [{}] },
        'Asia/Shanghai',
        new Date('2026-07-27T04:00:00.000Z'),
      ),
    );
    assert.doesNotThrow(() =>
      buildDuolingoLandingStats(
        {},
        { summaries: [] },
        'Asia/Shanghai',
        new Date('2026-07-27T04:00:00.000Z'),
      ),
    );
  });

  it('日期字符串保持日历键，Unix 秒按配置时区转换', () => {
    assert.equal(
      parseDuolingoDateKey('2026-01-02', 'America/Los_Angeles'),
      '2026-01-02',
    );
    assert.equal(
      parseDuolingoDateKey(
        Date.parse('2026-01-02T01:00:00Z') / 1000,
        'America/Los_Angeles',
      ),
      '2026-01-01',
    );
  });

  it('联赛严格限定 tier 0..9，并支持 tracking fallback', () => {
    assert.deepEqual(parseDuolingoLeague({ tier: 9 }), {
      tier: 9,
      name: '钻石',
    });
    assert.deepEqual(
      parseDuolingoLeague({
        tracking_properties: { league_tier: 3 },
      }),
      { tier: 3, name: '蓝宝石' },
    );
    assert.equal(parseDuolingoLeague({ tier: 10 }), null);
  });

  it('连胜和 tier 拒绝小数，并只读取当前学习语言的 fallback tier', () => {
    assert.equal(parseDuolingoStreak({ streak: 2.8 }), null);
    assert.equal(parseDuolingoLeague({ tier: 9.9 }), null);
    assert.deepEqual(
      parseDuolingoLeague({
        language_data: {
          en: { current_learning: false, tier: 2 },
          ja: { current_learning: true, tier: 7 },
        },
      }),
      { tier: 7, name: '珍珠' },
    );
    assert.equal(
      parseDuolingoLeague({
        language_data: {
          en: { current_learning: false, tier: 2 },
        },
      }),
      null,
    );
  });

  it('语言按 learningLanguage 合并、排除非语言课程，以全部语言 XP 为分母', () => {
    const languages = parseDuolingoLanguages({
      courses: [
        { learningLanguage: 'ja', title: '日语', xp: 60 },
        { learning_language: 'ja', title: '日语', xp: 20 },
        { learningLanguage: 'en', title: '英语', xp: 15 },
        { learningLanguage: 'fr', title: '法语', xp: 5 },
        { learningLanguage: 'math', subject: 'math', xp: 1000 },
      ],
    });
    assert.equal(languages.length, 2);
    assert.equal(languages[0].code, 'ja');
    assert.equal(languages[0].xp, 80);
    assert.equal(languages[0].share, 0.8);
    assert.equal(languages[1].share, 0.15);
  });

  it('构造固定 7 日与闰年日历，区分时长未知、零 XP 和未来', () => {
    const stats = buildDuolingoLandingStats(
      {
        site_streak: 12,
        streak: 3,
        tier: 2,
        courses: [],
      },
      {
        summaries: [
          {
            date: '2024-02-28',
            gainedXp: 10,
            totalSessionTime: 30,
          },
          { date: '2024-02-29', gained_xp: 20 },
        ],
      },
      'Asia/Shanghai',
      new Date('2024-03-01T04:00:00.000Z'),
    );

    assert.equal(stats.streakDays, 12);
    assert.equal(stats.last7Days.days.length, 7);
    assert.equal(stats.last7Days.totalXp, 30);
    assert.equal(stats.last7Days.totalLearningSeconds, null);
    assert.equal(stats.yearlyXp.days.length, 366);
    assert.deepEqual(
      stats.yearlyXp.days.find((day) => day.date === '2024-02-27'),
      { date: '2024-02-27', xp: 0, future: false },
    );
    assert.deepEqual(
      stats.yearlyXp.days.find((day) => day.date === '2024-03-02'),
      { date: '2024-03-02', xp: null, future: true },
    );
  });

  it('年初请求起点覆盖上一年度的 7 日窗口', () => {
    assert.equal(
      getDuolingoSummaryStartDate(
        'Asia/Shanghai',
        new Date('2026-01-02T04:00:00.000Z'),
      ),
      '2025-12-27',
    );
    assert.equal(
      getDuolingoSummaryStartDate(
        'Asia/Shanghai',
        new Date('2026-07-27T04:00:00.000Z'),
      ),
      '2026-01-01',
    );
  });
});
