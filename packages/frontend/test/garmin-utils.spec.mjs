import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const {
  formatActivityDate,
  formatCalories,
  formatDistance,
  formatDuration,
  getRouteEndpoints,
  getGarminMetricGroups,
  getGarminCardMetrics,
} = await jiti.import('../src/pages/Landing/components/LandingGarminStats/utils.ts')
const { resolveApiAssetUrl } = await jiti.import('../src/utils/api-url.ts')

describe('Landing Garmin view utils', () => {
  it('按 API base 解析媒体地址并保留已有绝对地址', () => {
    const coverPath = '/garmin/covers/example.webp'
    assert.equal(
      resolveApiAssetUrl(coverPath, 'http://localhost:4000'),
      'http://localhost:4000/garmin/covers/example.webp',
    )
    assert.equal(resolveApiAssetUrl(coverPath, '/api/'), '/api/garmin/covers/example.webp')
    assert.equal(
      resolveApiAssetUrl('https://cdn.example.com/example.webp', '/api'),
      'https://cdn.example.com/example.webp',
    )
  })

  it('格式化距离和时长，缺失或非法距离返回 null 供 UI 省略', () => {
    assert.equal(formatDistance(null), null)
    assert.equal(formatDistance(-1), null)
    assert.equal(formatDistance(Number.NaN), null)
    assert.equal(formatDistance(5_123), '5.12 km')
    assert.equal(formatDuration(59), '0:59')
    assert.equal(formatDuration(3_661), '1:01:01')
  })

  it('格式化消耗热量，非法值返回 null', () => {
    assert.equal(formatCalories(null), null)
    assert.equal(formatCalories(-1), null)
    assert.equal(formatCalories(342.6), '343 kcal')
  })

  it('按上海时区展示活动日期', () => {
    assert.match(formatActivityDate('2026-07-27T16:30:00.000Z'), /7月28日/)
  })

  it('只从安全 M/L path 提取首尾点', () => {
    assert.deepEqual(getRouteEndpoints('M 4 96 L 50 20 L 96 4'), {
      start: { x: 4, y: 96 },
      end: { x: 96, y: 4 },
    })
    assert.equal(getRouteEndpoints('M 4 96 C 20 20 30 30 96 4'), null)
  })

  it('按活动预设组织指标、保留有效 0 并隐藏椭圆机距离', () => {
    const summary = {
      publicId: 'public',
      type: 'elliptical',
      typeDisplay: '椭圆机',
      date: '2026-07-28T00:00:00Z',
      distanceMeters: 5000,
      durationSeconds: 1800,
      calories: 0,
      locationName: null,
      deviceSource: null,
      route: null,
      cover: null,
      metrics: {
        averagePaceSecondsPerKm: null,
        averageHeartRateBpm: 0,
        maxHeartRateBpm: 170,
        averageCadencePerMinute: null,
        averagePowerWatts: null,
        trainingEffect: null,
        steps: 1200,
      },
    }
    const detail = {
      ...summary,
      movingDurationSeconds: null,
      averagePaceSecondsPerKm: null,
      averageSpeedMetersPerSecond: null,
      maxSpeedMetersPerSecond: null,
      averageHeartRateBpm: 0,
      maxHeartRateBpm: 170,
      elevationGainMeters: null,
      averageCadencePerMinute: null,
      averagePowerWatts: null,
      trainingEffect: null,
      anaerobicTrainingEffect: 1.2,
      activityTrainingLoad: 42,
      bodyBatteryDelta: null,
      steps: 1200,
      lapCount: null,
      splits: [],
    }
    const groups = getGarminMetricGroups(summary, detail)
    assert.deepEqual(
      groups.core.map((metric) => metric.key),
      ['duration', 'calories', 'averageHeartRate'],
    )
    assert.equal(
      groups.core.some((metric) => metric.key === 'distance'),
      false,
    )
    assert.equal(groups.core.find((metric) => metric.key === 'calories')?.value, '0 kcal')
    assert.equal(groups.core.find((metric) => metric.key === 'averageHeartRate')?.value, '0 bpm')
    assert.equal(
      groups.secondary.find((metric) => metric.key === 'anaerobicTrainingEffect')?.value,
      '1',
    )
    assert.equal(groups.secondary.find((metric) => metric.key === 'trainingLoad')?.value, '42')
    assert.equal(groups.secondary.find((metric) => metric.key === 'steps')?.value, '1200 步')
  })

  it('为室内骑行选择最多五项非空指标并使用踏频文案', () => {
    const metrics = getGarminCardMetrics({
      publicId: 'indoor-bike',
      type: 'indoor_cycling',
      typeDisplay: '室内骑行',
      date: '2026-07-28T00:00:00Z',
      distanceMeters: 20_000,
      durationSeconds: 3600,
      calories: 500,
      locationName: null,
      deviceSource: null,
      route: null,
      cover: null,
      metrics: {
        averagePaceSecondsPerKm: null,
        averageHeartRateBpm: 142,
        maxHeartRateBpm: 170,
        averageCadencePerMinute: 88,
        averagePowerWatts: 210,
        trainingEffect: 3.2,
        steps: null,
      },
    })

    assert.deepEqual(
      metrics.map((metric) => metric.key),
      ['duration', 'calories', 'averageHeartRate', 'power', 'cadence'],
    )
    assert.equal(metrics.find((metric) => metric.key === 'cadence')?.label, '踏频')
    assert.equal(metrics.length, 5)
  })

  it('足球详情展示有值的无氧效果、训练负荷和步数', () => {
    const summary = {
      publicId: 'soccer',
      type: 'soccer',
      typeDisplay: '足球',
      date: '2026-07-28T00:00:00Z',
      distanceMeters: 8_200,
      durationSeconds: 5_400,
      calories: 720,
      locationName: null,
      deviceSource: null,
      route: null,
      cover: null,
      metrics: {
        averagePaceSecondsPerKm: null,
        averageHeartRateBpm: 148,
        maxHeartRateBpm: 184,
        averageCadencePerMinute: null,
        averagePowerWatts: null,
        trainingEffect: 3.8,
        steps: 9_430,
      },
    }
    const groups = getGarminMetricGroups(summary, {
      ...summary,
      movingDurationSeconds: 4_900,
      averagePaceSecondsPerKm: null,
      averageSpeedMetersPerSecond: null,
      maxSpeedMetersPerSecond: 7.5,
      averageHeartRateBpm: 148,
      maxHeartRateBpm: 184,
      elevationGainMeters: null,
      averageCadencePerMinute: null,
      averagePowerWatts: null,
      trainingEffect: 3.8,
      anaerobicTrainingEffect: 2.6,
      activityTrainingLoad: 188,
      bodyBatteryDelta: null,
      steps: 9_430,
      lapCount: null,
      splits: [],
    })

    assert.deepEqual(
      groups.secondary.map((metric) => metric.key),
      [
        'averageHeartRate',
        'maxHeartRate',
        'maxSpeed',
        'trainingEffect',
        'anaerobicTrainingEffect',
        'trainingLoad',
        'steps',
      ],
    )
  })

  it('仅路线卡使用按钮语义，倾斜 transform 不再缩放或飞入详情', async () => {
    const [cardSource, coverSource, tiltSource, dialogSource, statsSource] = await Promise.all([
      readFile(
        new URL(
          '../src/pages/Landing/components/LandingGarminStats/GarminActivityCard.vue',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/pages/Landing/components/LandingGarminStats/GarminActivityCover.vue',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/pages/Landing/components/LandingGarminStats/hooks/usePointerTilt.ts',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/pages/Landing/components/LandingGarminStats/GarminActivityDetailDialog.vue',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/Landing/components/LandingGarminStats/index.vue', import.meta.url),
        'utf8',
      ),
    ])

    assert.match(cardSource, /isInteractive \? 'button' : 'article'/)
    assert.match(cardSource, /isInteractive \? `查看\$\{activity\.typeDisplay\}详情` : undefined/)
    assert.match(cardSource, /\.garmin-card__data-grid\s*\{[\s\S]*align-content: end/)
    assert.doesNotMatch(cardSource, /\.garmin-card__data-header\s*\{[^}]*border-bottom/)
    assert.match(coverSource, /\.garmin-cover__distance\s*\{[\s\S]*right: 0\.4rem/)
    assert.doesNotMatch(coverSource, /garmin-cover__attribution/)
    assert.doesNotMatch(tiltSource, /scale\(/)
    assert.match(tiltSource, /rotateX/)
    assert.match(dialogSource, /max-\[800px\]:!w-\[calc\(100vw-1rem\)\]/)
    assert.match(statsSource, /useMediaQuery\('\(max-width: 800px\)'\)/)
    assert.match(statsSource, /:detail-enabled="!isMobile"/)
    assert.match(statsSource, /<GarminActivityDetailDialog\s+v-if="!isMobile"/)
    assert.doesNotMatch(statsSource, /useSharedElementTransition|transition\.open|transition\.close/)
  })
})
