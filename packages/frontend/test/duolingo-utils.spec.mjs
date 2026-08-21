import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const {
  buildHeatmapCells,
  formatLearningTime,
  getHeatmapLeadingBlanks,
  getHorizontalScrollLeft,
} = await jiti.import('../src/pages/Landing/duolingo-utils.ts')

describe('Landing Duolingo view utils', () => {
  it('学习时长 null 保持未知，不伪装成 0', () => {
    assert.equal(formatLearningTime(null), '暂无可靠数据')
    assert.equal(formatLearningTime(0), '0 秒')
    assert.equal(formatLearningTime(3_900), '1 小时 5 分钟')
  })

  it('热力图区分未来、真实 0 与四档正 XP', () => {
    const cells = buildHeatmapCells([
      { date: '2026-01-01', xp: 0, future: false },
      { date: '2026-01-02', xp: 10, future: false },
      { date: '2026-01-03', xp: 20, future: false },
      { date: '2026-01-04', xp: 30, future: false },
      { date: '2026-01-05', xp: 40, future: false },
      { date: '2026-01-06', xp: null, future: true },
    ])
    assert.equal(cells[0].intensity, 0)
    assert.match(cells[0].label, /0 XP/)
    assert.equal(cells[5].intensity, 0)
    assert.match(cells[5].label, /未来日期/)
    assert.deepEqual(cells.slice(1, 5).map((cell) => cell.intensity), [1, 2, 3, 4])
  })

  it('按星期为年度网格补齐前导空格', () => {
    assert.equal(getHeatmapLeadingBlanks('2026-01-01').length, 4)
  })

  it('只滚动热力图横轴，不通过 scrollIntoView 带动 landing 页纵向滚动', async () => {
    assert.equal(
      getHorizontalScrollLeft(
        { clientWidth: 320, scrollWidth: 800 },
        { offsetLeft: 740, offsetWidth: 12 },
      ),
      432,
    )
    assert.equal(
      getHorizontalScrollLeft(
        { clientWidth: 800, scrollWidth: 800 },
        { offsetLeft: 740, offsetWidth: 12 },
      ),
      0,
    )

    const component = await readFile(
      new URL('../src/pages/Landing/components/LandingDuolingoStats.vue', import.meta.url),
      'utf8',
    )
    assert.equal(component.includes('scrollIntoView'), false)
  })
})
