import type { IGarminLandingStats } from '@applog/common'

export interface IProps {
  stats?: IGarminLandingStats | null
  loading?: boolean
}

export interface IRoutePoint {
  x: number
  y: number
}

export interface IRouteEndpoints {
  start: IRoutePoint
  end: IRoutePoint
}

export interface IGarminActivityView {
  key: string
  typeDisplay: string
  dateText: string
  distanceText: string
  durationText: string
  sourceText: string
  route: {
    pathData: string
    viewBox: string
    endpoints: IRouteEndpoints
  } | null
}
