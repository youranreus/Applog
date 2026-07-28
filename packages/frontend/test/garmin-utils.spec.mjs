import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const {
  formatActivityDate,
  formatCalories,
  formatDistance,
  formatDuration,
  getRouteEndpoints,
} = await jiti.import('../src/pages/Landing/components/LandingGarminStats/utils.ts')

describe('Landing Garmin view utils', () => {
  it('格式化距离和时长，缺失或非法距离返回 null 供 UI 省略', () => {
    assert.equal(formatDistance(null), null)
    assert.equal(formatDistance(-1), null)
    assert.equal(formatDistance(Number.NaN), null)
    assert.equal(formatDistance(5_123), '5.12 km')
    assert.equal(formatDuration(59), '0:59')
    assert.equal(formatDuration(3_661), '1:01:01')
  })

  it('格式化消耗热量，非法值返回 null', () => {
    assert.equal(formatCalories(null), null)
    assert.equal(formatCalories(-1), null)
    assert.equal(formatCalories(342.6), '343 kcal')
  })

  it('按上海时区展示活动日期', () => {
    assert.match(formatActivityDate('2026-07-27T16:30:00.000Z'), /7月28日/)
  })

  it('只从安全 M/L path 提取首尾点', () => {
    assert.deepEqual(getRouteEndpoints('M 4 96 L 50 20 L 96 4'), {
      start: { x: 4, y: 96 },
      end: { x: 96, y: 4 },
    })
    assert.equal(getRouteEndpoints('M 4 96 C 20 20 30 30 96 4'), null)
  })
})
