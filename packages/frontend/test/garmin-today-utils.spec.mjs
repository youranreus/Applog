import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { formatMetric, formatSleep } = await jiti.import(
  '../src/pages/Landing/components/LandingTodayStatus/utils.ts',
)

describe('Landing Garmin today formatting', () => {
  it('preserves observed zero and marks only null missing', () => {
    assert.equal(formatMetric(0, ' 步'), '0 步')
    assert.equal(formatMetric(null, ' 步'), '—')
  })

  it('uses duration only as an explicit sleep fallback', () => {
    assert.deepEqual(formatSleep({ kind: 'score', score: 88 }), {
      label: '睡眠评分',
      value: '88 分',
    })
    assert.deepEqual(formatSleep({ kind: 'duration', seconds: 27000 }), {
      label: '睡眠时长',
      value: '7 小时 30 分',
    })
    assert.deepEqual(formatSleep({ kind: 'missing' }), { label: '睡眠', value: '—' })
    assert.deepEqual(formatSleep({ kind: 'duration', seconds: 28785 }), {
      label: '睡眠时长',
      value: '8 小时 0 分',
    })
  })
})
