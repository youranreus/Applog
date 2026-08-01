import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { FEIBI_ACTIONS, FEIBI_GRID, getFeibiAction, getFeibiBackgroundPosition, getNextFeibiFrame } =
  await jiti.import('../src/pages/Landing/components/LandingYesterdayStatus/feibi-sprite.ts')

describe('Feibi sprite model', () => {
  it('maps Garmin states and missing data to the intended upstream actions', () => {
    assert.equal(getFeibiAction(null), 'waiting')
    assert.equal(getFeibiAction('活得很好！'), 'jumping')
    assert.equal(getFeibiAction('活得不错'), 'waving')
    assert.equal(getFeibiAction('活着'), 'idle')
    assert.equal(getFeibiAction('努力活着'), 'failed')
  })

  it('keeps the v1 atlas and all standard action timings intact', () => {
    assert.deepEqual(FEIBI_GRID, { columns: 8, rows: 9, cellWidth: 192, cellHeight: 208 })
    assert.deepEqual(FEIBI_ACTIONS, {
      idle: { row: 0, frameDurations: [280, 110, 110, 140, 140, 320] },
      'running-right': { row: 1, frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
      'running-left': { row: 2, frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
      waving: { row: 3, frameDurations: [140, 140, 140, 280] },
      jumping: { row: 4, frameDurations: [140, 140, 140, 140, 280] },
      failed: { row: 5, frameDurations: [140, 140, 140, 140, 140, 140, 140, 240] },
      waiting: { row: 6, frameDurations: [150, 150, 150, 150, 150, 260] },
      running: { row: 7, frameDurations: [120, 120, 120, 120, 120, 220] },
      review: { row: 8, frameDurations: [150, 150, 150, 150, 150, 280] },
    })
  })

  it('loops within each action and recovers invalid frame indexes at frame zero', () => {
    assert.equal(getNextFeibiFrame('waving', 0), 1)
    assert.equal(getNextFeibiFrame('waving', 3), 0)
    assert.equal(getNextFeibiFrame('waving', -1), 0)
    assert.equal(getNextFeibiFrame('waving', 9), 0)
  })

  it('maps the atlas corners to stable percentage positions', () => {
    assert.equal(getFeibiBackgroundPosition(0, 0), '0% 0%')
    assert.equal(getFeibiBackgroundPosition(8, 7), '100% 100%')
  })
})
