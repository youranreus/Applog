import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  formatWeatherCode,
  normalizeTemperatureC,
} from '../src/module/weather/weather.utils';

describe('weather utils', () => {
  it('将 WMO weather code 映射为简短中文天气', () => {
    assert.equal(formatWeatherCode(0), '晴');
    assert.equal(formatWeatherCode(2), '多云');
    assert.equal(formatWeatherCode(61), '小雨');
    assert.equal(formatWeatherCode(95), '雷雨');
    assert.equal(formatWeatherCode(999), null);
  });

  it('温度保留一位小数并拒绝非法值', () => {
    assert.equal(normalizeTemperatureC(23.46), 23.5);
    assert.equal(normalizeTemperatureC(-3.04), -3);
    assert.equal(normalizeTemperatureC(Number.NaN), null);
    assert.equal(normalizeTemperatureC('23'), null);
  });
});
