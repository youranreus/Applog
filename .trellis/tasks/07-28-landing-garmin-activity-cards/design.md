# Landing Garmin 活动卡片 — Technical Design

## Architecture

```text
Garmin list payload
  → worker normalize (+calories, +locationName, expanded TYPE_LABELS)
  → MySQL garmin_activity_snapshot
  → NestJS GarminService whitelist DTO
  → Vue LandingGarminStats (horizontal cards + covers)
```

NestJS 仍不调用 Garmin；公开面只读白名单快照。

## Data Contract

### `IGarminLandingActivity`（common）

```ts
interface IGarminLandingActivity {
  type: string
  typeDisplay: string
  date: string
  distanceMeters: number | null
  durationSeconds: number
  calories: number | null
  locationName: string | null
  deviceSource: string | null
  route: IGarminRoutePreview | null
}
```

### DB（TypeORM synchronize + worker SQL 双写对齐）

在 `garmin_activity_snapshot` 增加：

| Column | Type | Notes |
|--------|------|-------|
| `calories` | `int unsigned NULL` | 非负整数；非法/缺失 → null |
| `locationName` | `varchar(64) NULL` | 裁剪后的展示字符串 |

不加 lat/lon 列。

## Worker Normalization

### Calories
- 读取 list 字段 `calories`（有限非负 number）
- `round` 为 int；`< 0` 或非有限 → null

### Location
- 优先 `locationName`；若无则尝试 Garmin 偶发的同类字符串字段（如 `location` 仅当其为非空 string）
- `strip`、长度 cap 64
- 拒绝匹配坐标样式（含明显 lat/lon 数字对）的字符串
- 空串 → null

### TYPE_LABELS（最小集合 + 常见扩展）

必含：`elliptical`、`track_running`、`soccer`。  
建议同批：`indoor_cycling`、`strength_training`、`cardio`、`yoga`、`open_water_swimming`、`lap_swimming`、`mountain_biking`、`gravel_cycling`、`virtual_run`、`ultra_run`。  
未知：`normalized_type.replace("_", " ")`（保持现行为）。

### Upsert
- repository INSERT/UPDATE 增加两列；`activityTypeDisplay` 继续每次覆盖，便于旧英文标签刷新

## NestJS

`GarminService.getLandingStats` map 增加 `calories`、`locationName`。  
测试断言公开 JSON 不含 `latitude` / `sourceActivityId`，并包含新字段。

## Frontend Presentation

### Layout
- 外层：`overflow-x: auto` 横向轨道 + 左右渐变遮罩（依据 `scrollLeft` / `scrollWidth` / `clientWidth` 切换 `canScrollLeft` / `canScrollRight`）
- 卡片：固定宽度（约 16–18rem），上封面下正文；封面 `aspect-ratio` 约 16/10
- Skeleton 同步为横向骨架卡

### Cover 分流
```text
if activity.route → GpsRouteCover (existing SVG path)
else → ActivityTypeCover(type)  // 静态 SVG 组件/映射
```

`ActivityTypeCover`：按 type 选一组克制的线稿/几何插画（椭圆机、足球、跑步机、默认运动符号等）；未知 type 走默认封面。足球**不**使用热力格子。

### Metrics
Presentation hook 派生：
- `dateText`（必有）
- `locationText`（null → 不渲染）
- `distanceText`（null → 不渲染；**删除「距离暂无」**）
- `caloriesText`（null → 不渲染；有则如 `342 kcal`）
- `durationText`（必有）

Icon：lucide（`Clock`/`Calendar`、`MapPin`、`Route`、`Flame`、`Timer`），尺寸 ~14px，颜色 `landing-muted`。

### 中文
权威在 worker；前端不重复维护完整词典。可选：对极端旧缓存做薄 fallback map，非必须。

## Privacy / Compatibility

- 地点仅为展示字符串，不是可点击地图
- 旧库行在首次同步前 `calories`/`locationName` 为 null → UI 省略，不破版
- 后端 `synchronize: true` 加列；生产 worker SQL 与实体字段名一致（camelCase 列名，与现表一致）

## Trade-offs

| 选择 | 原因 |
|------|------|
| 不做足球热力 | 无真数据时示意热力会误导；用户明确要求改静态封面 |
| 消耗可空省略 | Garmin 偶发缺字段；不伪造 |
| 地点仅字符串 | 维持「无地理语义坐标」公开契约 |
