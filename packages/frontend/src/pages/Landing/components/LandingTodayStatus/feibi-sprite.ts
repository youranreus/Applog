import { GARMIN_TODAY_STATUS, type GarminTodayStatus } from '@applog/common'

export const FEIBI_GRID = {
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
} as const

export const FEIBI_ACTIONS = {
  idle: { row: 0, frameDurations: [280, 110, 110, 140, 140, 320] },
  'running-right': { row: 1, frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
  'running-left': { row: 2, frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, frameDurations: [140, 140, 140, 280] },
  jumping: { row: 4, frameDurations: [140, 140, 140, 140, 280] },
  failed: { row: 5, frameDurations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, frameDurations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, frameDurations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, frameDurations: [150, 150, 150, 150, 150, 280] },
} as const

export type FeibiAction = keyof typeof FEIBI_ACTIONS
export type FeibiActionConfig = (typeof FEIBI_ACTIONS)[FeibiAction]

const STATUS_ACTIONS: Record<GarminTodayStatus, FeibiAction> = {
  [GARMIN_TODAY_STATUS.GREAT]: 'jumping',
  [GARMIN_TODAY_STATUS.GOOD]: 'waving',
  [GARMIN_TODAY_STATUS.ALIVE]: 'idle',
  [GARMIN_TODAY_STATUS.STRUGGLING]: 'failed',
}

/** Returns the sprite action for the public Garmin status, including the no-data state. */
export function getFeibiAction(status: GarminTodayStatus | null): FeibiAction {
  return status ? STATUS_ACTIONS[status] : 'waiting'
}

/** Advances a frame, wrapping to the action's first valid frame. */
export function getNextFeibiFrame(action: FeibiAction, frame: number): number {
  const frameCount = FEIBI_ACTIONS[action].frameDurations.length
  return frame >= 0 && frame < frameCount - 1 ? frame + 1 : 0
}

/** Returns the percentage background position for a valid v1 atlas cell. */
export function getFeibiBackgroundPosition(row: number, column: number): string {
  const x = (column / (FEIBI_GRID.columns - 1)) * 100
  const y = (row / (FEIBI_GRID.rows - 1)) * 100
  return `${x}% ${y}%`
}
