import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const {
  formatCompactToken,
  formatEstimatedUsd,
  formatWakaTimeDateRange,
  getWakaTimeTagTint,
  getWakaTimeTokenShares,
  sortWakaTimeUsageItems,
  sumKnownTokens,
} = await jiti.import('../src/pages/Landing/wakatime-utils.ts')

describe('Landing WakaTime view utils', () => {
  it('格式化紧凑 token', () => {
    assert.equal(formatCompactToken(null), '—')
    assert.match(formatCompactToken(8_600_000), /860万|8\.6M/i)
  })

  it('成本 null 不伪装成 $0.00，真实 0 可显示', () => {
    assert.equal(formatEstimatedUsd(null), null)
    assert.equal(formatEstimatedUsd(0), '$0.00')
  })

  it('格式化周期并只汇总已上报 token', () => {
    assert.equal(formatWakaTimeDateRange('2026-07-23', '2026-08-21'), '7月23日 – 8月21日')
    assert.equal(sumKnownTokens([null, null, null]), null)
    assert.equal(sumKnownTokens([100, null, 20]), 120)
    assert.equal(sumKnownTokens([0, 0, 0]), 0)
    assert.deepEqual(getWakaTimeTokenShares([100, null, 20]), [5 / 6, null, 1 / 6])
    assert.deepEqual(getWakaTimeTokenShares([0, 0, 0]), [0, 0, 0])
    assert.deepEqual(getWakaTimeTokenShares([null, null, null]), [null, null, null])
  })

  it('用量 tag 按占比降序且色深限制在克制范围', () => {
    const sorted = sortWakaTimeUsageItems([
      { name: 'Vue', share: 0.2 },
      { name: 'TypeScript', share: 0.7 },
      { name: 'CSS', share: 0.1 },
    ])
    assert.deepEqual(
      sorted.map((item) => item.name),
      ['TypeScript', 'Vue', 'CSS'],
    )
    assert.equal(getWakaTimeTagTint(-1), 8)
    assert.equal(getWakaTimeTagTint(0.5), 18)
    assert.equal(getWakaTimeTagTint(2), 28)
  })

  it('相同用量的 tag 保留上游稳定顺序', () => {
    const sorted = sortWakaTimeUsageItems([
      { name: 'Vue', share: 0.2 },
      { name: 'CSS', share: 0.2 },
      { name: 'TypeScript', share: 0.7 },
    ])
    assert.deepEqual(
      sorted.map((item) => item.name),
      ['TypeScript', 'Vue', 'CSS'],
    )
  })

  it('单卡展示 token 占比和工具模型，旧摘要与常用语言已移除', async () => {
    const [card, summary, landing] = await Promise.all([
      readFile(
        new URL('../src/pages/Landing/components/wakatime/WakaTimeUsageCard.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/Landing/components/LandingWakaTimeStats.vue', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/pages/Landing/index.vue', import.meta.url), 'utf8'),
    ])
    assert.match(card, /最近 30 天 · {{ periodText }}/)
    assert.match(card, /role="img" :aria-label="shareLabel"/)
    assert.match(card, /<ul class="usage-card__legend" aria-label="Token 明细">/)
    assert.match(
      card,
      /<strong>{{ item\.formattedValue }}<\/strong>\s*<small>{{ item\.formattedShare }}<\/small>/,
    )
    assert.match(card, /工作环境 \/ 工具/)
    assert.match(card, /AI 模型/)
    assert.match(card, /sortWakaTimeUsageItems/)
    assert.match(card, /<strong>{{ tag\.percentage }}<\/strong>/)
    assert.match(card, /border-radius: 13px/)
    assert.match(card, /border: 1px solid/)
    assert.doesNotMatch(card, /box-shadow|常用语言|languages|Model cost|更新于|usage-card__details/)
    assert.doesNotMatch(card, /border-top/)
    assert.match(card, /grid-template-columns: minmax\(0, 3fr\) minmax\(0, 2fr\)/)
    assert.match(card, /\.usage-card__legend \{[\s\S]*?display: flex/)
    assert.match(card, /return value === null \? '—' : `~\$\{value\}`/)
    assert.match(summary, /<p>AI Cost<\/p>/)
    assert.match(summary, /<h2 id="wakatime-title">开发状态<\/h2>/)
    assert.doesNotMatch(summary, /summary30Days|summary7Days|fetchedAt|WakaTimeHeatmap|Code Pulse/)
    assert.doesNotMatch(summary, /30 天编码|日均投入|活跃天数|AI 行变更占比/)
    assert.ok(landing.indexOf('<LandingWakaTimeStats') < landing.indexOf('<LandingSlogan'))
  })

  it('单卡使用紧凑字号与留白并保留窄屏重排', async () => {
    const [card, summary] = await Promise.all([
      readFile(
        new URL('../src/pages/Landing/components/wakatime/WakaTimeUsageCard.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/Landing/components/LandingWakaTimeStats.vue', import.meta.url),
        'utf8',
      ),
    ])
    assert.match(card, /font-size: clamp\(1\.75rem, 5vw, 2\.35rem\)/)
    assert.match(card, /font-size: clamp\(1\.15rem, 3vw, 1\.5rem\)/)
    assert.match(card, /padding: clamp\(1\.1rem, 3vw, 1\.5rem\)/)
    assert.match(card, /@media \(max-width: 760px\)/)
    assert.match(card, /grid-template-columns: 1fr/)
    assert.match(summary, /height: 300px/)
  })
})
