import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeUmamiActiveVisitors } from '../src/module/analytics/umami-active.utils';

describe('normalizeUmamiActiveVisitors', () => {
  it('兼容 Umami 常见 active 返回形态', () => {
    assert.equal(normalizeUmamiActiveVisitors(3), 3);
    assert.equal(normalizeUmamiActiveVisitors({ x: 4 }), 4);
    assert.equal(normalizeUmamiActiveVisitors({ value: 5 }), 5);
    assert.equal(normalizeUmamiActiveVisitors({ visitors: 6 }), 6);
    assert.equal(normalizeUmamiActiveVisitors({ totals: { visitors: 7 } }), 7);
  });

  it('拒绝负数、非有限数与未知结构', () => {
    assert.equal(normalizeUmamiActiveVisitors(-1), null);
    assert.equal(normalizeUmamiActiveVisitors(Number.NaN), null);
    assert.equal(normalizeUmamiActiveVisitors({ x: '3' }), null);
    assert.equal(normalizeUmamiActiveVisitors({}), null);
  });
});
