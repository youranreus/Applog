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
  type: string
  typeDisplay: string
  dateText: string
  locationText: string | null
  distanceText: string | null
  caloriesText: string | null
  durationText: string
  route: {
    pathData: string
    viewBox: string
    endpoints: IRouteEndpoints
  } | null
}
