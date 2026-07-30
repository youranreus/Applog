import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { evaluateGarminToday, getGarminLocalClock } from '../src/module/garmin/garmin-today.utils';
import type { IGarminTodayMetrics } from '@applog/common';

const complete: IGarminTodayMetrics = {
  steps: 8000,
  stepGoal: 8000,
  restingHeartRateBpm: 52,
  intensityMinutes: 30,
  averageStressLevel: 15,
  bodyBattery: 90,
  sleep: { kind: 'score', score: 90 },
};

describe('Garmin today evaluation', () => {
  it('uses the configured local calendar around UTC midnight', () => {
    assert.deepEqual(
      getGarminLocalClock(new Date('2026-07-29T17:30:00.000Z'), 'Asia/Shanghai'),
      { date: '2026-07-30', hour: 1.5 },
    );
  });

  it('does not penalize morning before progress dimensions become eligible', () => {
    const result = evaluateGarminToday(
      { ...complete, steps: 0, intensityMinutes: 0 },
      new Date('2026-07-30T00:00:00.000Z'),
      7,
    );
    assert.equal(result.status, '活得很好！');
  });

  it('does not rate snapshots with fewer than three valid dimensions', () => {
    const result = evaluateGarminToday(
      {
        ...complete,
        sleep: { kind: 'missing' },
        averageStressLevel: null,
        steps: null,
        intensityMinutes: null,
      },
      new Date('2026-07-30T12:00:00.000Z'),
      20,
    );
    assert.equal(result.status, null);
    assert.equal(result.score, null);
  });

  it('classifies on raw threshold values rather than rounded display scores', () => {
    const at = (value: number): IGarminTodayMetrics => ({
      ...complete,
      sleep: { kind: 'score', score: value },
      bodyBattery: value,
      averageStressLevel: 100 - value,
      steps: 8000 * (value / 100),
      intensityMinutes: 30 * (value / 100),
    });
    assert.equal(evaluateGarminToday(at(84.9), new Date(), 23).status, '活得不错');
    assert.equal(evaluateGarminToday(at(69.9), new Date(), 23).status, '活着');
    assert.equal(evaluateGarminToday(at(49.9), new Date(), 23).status, '努力活着');
    assert.equal(evaluateGarminToday(at(85), new Date(), 23).status, '活得很好！');
  });
});
