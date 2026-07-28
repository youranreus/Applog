/** 可公开的抽象路线，仅包含无地理语义的 SVG 几何。 */
export interface IGarminRoutePreview {
  pathData: string;
  viewBox: string;
}

/** Landing 展示的一条 Garmin 活动。 */
export interface IGarminLandingActivity {
  type: string;
  typeDisplay: string;
  date: string;
  distanceMeters: number | null;
  durationSeconds: number;
  deviceSource: string | null;
  route: IGarminRoutePreview | null;
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
