import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  evaluateGarminYesterday,
  getGarminYesterdayDate,
} from '../src/module/garmin/garmin-yesterday.utils';
import type { IGarminYesterdayMetrics } from '@applog/common';

const complete: IGarminYesterdayMetrics = {
  steps: 8000,
  stepGoal: 8000,
  restingHeartRateBpm: 52,
  intensityMinutes: 30,
  averageStressLevel: 15,
  bodyBattery: 90,
  sleep: { kind: 'score', score: 90 },
};

describe('Garmin yesterday evaluation', () => {
  it('uses the previous configured local calendar date around UTC midnight', () => {
    assert.equal(
      getGarminYesterdayDate(
        new Date('2026-07-29T17:30:00.000Z'),
        'Asia/Shanghai',
      ),
      '2026-07-29',
    );
    assert.equal(
      getGarminYesterdayDate(
        new Date('2026-07-29T15:30:00.000Z'),
        'Asia/Shanghai',
      ),
      '2026-07-28',
    );
  });

  it('uses full-day targets regardless of evaluation time', () => {
    const metrics = { ...complete, steps: 4000, intensityMinutes: 15 };
    const morning = evaluateGarminYesterday(
      metrics,
      new Date('2026-07-30T00:00:00.000Z'),
    );
    const evening = evaluateGarminYesterday(
      metrics,
      new Date('2026-07-30T14:00:00.000Z'),
    );
    assert.equal(morning.score, evening.score);
    assert.equal(morning.status, evening.status);
  });

  it('does not rate snapshots with fewer than three valid dimensions', () => {
    const result = evaluateGarminYesterday(
      {
        ...complete,
        sleep: { kind: 'missing' },
        averageStressLevel: null,
        steps: null,
        intensityMinutes: null,
      },
      new Date('2026-07-30T12:00:00.000Z'),
    );
    assert.equal(result.status, null);
    assert.equal(result.score, null);
  });

  it('classifies on raw threshold values rather than rounded display scores', () => {
    const at = (value: number): IGarminYesterdayMetrics => ({
      ...complete,
      sleep: { kind: 'score', score: value },
      bodyBattery: value,
      averageStressLevel: 100 - value,
      steps: 8000 * (value / 100),
      intensityMinutes: 30 * (value / 100),
    });
    assert.equal(
      evaluateGarminYesterday(at(84.9), new Date()).status,
      '活得不错',
    );
    assert.equal(evaluateGarminYesterday(at(69.9), new Date()).status, '活着');
    assert.equal(
      evaluateGarminYesterday(at(49.9), new Date()).status,
      '努力活着',
    );
    assert.equal(
      evaluateGarminYesterday(at(85), new Date()).status,
      '活得很好！',
    );
  });
});
