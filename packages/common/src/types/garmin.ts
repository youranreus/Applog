/** 可公开的抽象路线，仅包含无地理语义的 SVG 几何。 */
export interface IGarminRoutePreview {
  pathData: string;
  viewBox: string;
}

/** Public, coordinate-free activity cover descriptor. */
export interface IGarminActivityCover {
  url: string;
  width: number;
  height: number;
  attribution: string | null;
}

/** Compact public split. Missing source metrics remain null. */
export interface IGarminActivitySplit {
  index: number;
  type: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  averagePaceSecondsPerKm: number | null;
  averageHeartRateBpm: number | null;
}

/** Allowlisted public activity detail. */
export interface IGarminLandingActivityDetail {
  /** Nullable only during the schema-first migration window. */
  publicId: string | null;
  type: string;
  typeDisplay: string;
  date: string;
  distanceMeters: number | null;
  durationSeconds: number;
  movingDurationSeconds: number | null;
  calories: number | null;
  averagePaceSecondsPerKm: number | null;
  averageSpeedMetersPerSecond: number | null;
  maxSpeedMetersPerSecond: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  elevationGainMeters: number | null;
  averageCadencePerMinute: number | null;
  averagePowerWatts: number | null;
  trainingEffect: number | null;
  anaerobicTrainingEffect: number | null;
  activityTrainingLoad: number | null;
  bodyBatteryDelta: number | null;
  steps: number | null;
  lapCount: number | null;
  splits: IGarminActivitySplit[];
}

/** Landing 展示的一条 Garmin 活动。 */
export interface IGarminLandingActivity {
  publicId: string;
  type: string;
  typeDisplay: string;
  date: string;
  distanceMeters: number | null;
  durationSeconds: number;
  calories: number | null;
  locationName: string | null;
  deviceSource: string | null;
  route: IGarminRoutePreview | null;
  cover: IGarminActivityCover | null;
}

/**
 * Landing 唯一可公开的 Garmin 快照契约。
 * 不包含 Garmin 账号、活动 ID、原始坐标、FIT/GPX 或认证信息。
 */
export interface IGarminLandingStats {
  totalActivityCount: number;
  activities: IGarminLandingActivity[];
  fetchedAt: string;
  stale: boolean;
}
