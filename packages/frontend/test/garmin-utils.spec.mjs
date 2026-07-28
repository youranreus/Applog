import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { formatActivityDate, formatDistance, formatDuration, getRouteEndpoints } = await jiti.import(
  '../src/pages/Landing/components/LandingGarminStats/utils.ts',
)

describe('Landing Garmin view utils', () => {
  it('格式化距离和时长，不伪造缺失距离', () => {
    assert.equal(formatDistance(null), '距离暂无')
    assert.equal(formatDistance(5_123), '5.12 km')
    assert.equal(formatDuration(59), '0:59')
    assert.equal(formatDuration(3_661), '1:01:01')
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
