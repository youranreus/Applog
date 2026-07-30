import type {
  IGarminActivityCover,
  IGarminLandingActivity,
  IGarminLandingStats,
} from '@applog/common'

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
  publicId: string | null
  type: string
  typeDisplay: string
  dateText: string
  locationText: string | null
  distanceText: string | null
  caloriesText: string | null
  durationText: string
  cardMetrics: IGarminMetricView[]
  cover: IGarminActivityCover | null
  summary: IGarminLandingActivity
  route: {
    pathData: string
    viewBox: string
    endpoints: IRouteEndpoints
  } | null
}

export interface IGarminMetricView {
  key: string
  label: string
  value: string
}

export interface IGarminMetricGroups {
  core: IGarminMetricView[]
  secondary: IGarminMetricView[]
}
