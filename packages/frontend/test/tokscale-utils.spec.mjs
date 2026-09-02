import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const {
  formatTokenCount,
  formatUsd,
  formatTokscaleDay,
  isTokscaleDataDelayed,
  getTokscaleTokenShares,
} = await jiti.import('../src/pages/Landing/tokscale-utils.ts')

describe('Landing Tokscale view utils', () => {
  it('格式化 token 数量', () => {
    assert.equal(formatTokenCount(0), '0')
    assert.equal(formatTokenCount(999), '999')
    assert.equal(formatTokenCount(1_234), '1.2K')
    assert.equal(formatTokenCount(25_901_073), '25.9M')
    assert.equal(formatTokenCount(1_234_567_890), '1.2B')
  })

  it('格式化美元成本', () => {
    assert.equal(formatUsd(0), '$0.00')
    assert.equal(formatUsd(0.0047), '<$0.01')
    assert.equal(formatUsd(0.0448), '$0.04')
    assert.equal(formatUsd(10.719), '$10.72')
    assert.equal(formatUsd(1234.5), '$1,234.50')
  })

  it('格式化 Tokscale 日期', () => {
    assert.equal(formatTokscaleDay('2026-09-02', '2026-09-02'), '今天')
    assert.equal(formatTokscaleDay('2026-09-01', '2026-09-02'), '昨天')
    assert.equal(formatTokscaleDay('2026-08-30', '2026-09-02'), '8月30日')
  })

  it('数据延迟阈值边界为超过 3 天', () => {
    assert.equal(isTokscaleDataDelayed('2026-09-02', '2026-09-02'), false)
    assert.equal(isTokscaleDataDelayed('2026-09-01', '2026-09-02'), false)
    assert.equal(isTokscaleDataDelayed('2026-08-30', '2026-09-02'), false)
    assert.equal(isTokscaleDataDelayed('2026-08-29', '2026-09-02'), true)
  })

  it('计算五项 token 占比', () => {
    assert.deepEqual(
      getTokscaleTokenShares({ input: 10, output: 30, cacheRead: 60, cacheWrite: 0, reasoning: 0 }),
      [0.1, 0.3, 0.6, 0, 0],
    )
    assert.deepEqual(
      getTokscaleTokenShares({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }),
      [0, 0, 0, 0, 0],
    )
    assert.deepEqual(
      getTokscaleTokenShares({ input: 0, output: 0, cacheRead: 5, cacheWrite: 0, reasoning: 0 }),
      [0, 0, 1, 0, 0],
    )
  })

  it('Landing 使用 Tokscale 且位于 Duolingo 之后 Slogan 之前', async () => {
    const [landing, card, section, utils] = await Promise.all([
      readFile(new URL('../src/pages/Landing/index.vue', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/pages/Landing/components/tokscale/TokscaleUsageCard.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/Landing/components/LandingTokscaleStats.vue', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/pages/Landing/tokscale-utils.ts', import.meta.url), 'utf8'),
    ])
    assert.ok(landing.indexOf('<LandingDuolingoStats') < landing.indexOf('<LandingTokscaleStats'))
    assert.ok(landing.indexOf('<LandingTokscaleStats') < landing.indexOf('<LandingSlogan'))
    assert.match(section, /<p>AI Cost<\/p>/)
    assert.match(section, /<h2 id="tokscale-title">开发状态<\/h2>/)
    assert.match(section, /数据更新延迟/)
    assert.match(card, /grid-template-columns: minmax\(0, 1fr\) auto auto/)
    assert.match(card, /font-variant-numeric: tabular-nums/)
    assert.match(card, /text-overflow: ellipsis/)
    assert.match(utils, /Cache Read/)
    assert.match(utils, /Cache Write/)
    assert.match(utils, /Reasoning/)
    assert.doesNotMatch(card + section + landing, new RegExp(`Waka${'Time'}|waka${'time'}`))
  })
})
