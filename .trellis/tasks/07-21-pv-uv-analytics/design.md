# Design: 博客 PV/UV 统计与后台展示

## Architecture / Boundaries

新增独立 **Analytics** 能力，与 Post/Page 详情读模型解耦：

```
公开详情页 (PostDetail / PageDetail)
  → 内容加载成功
  → 读取/生成 localStorage applog_vid
  → POST /analytics/view { visitorId, contentType, contentId }
       → 校验已发布 + 非作者本人
       → 30 分钟去抖
       → 更新日聚合（site + content）与日 UV 去重
       → （可选）更新 lastHit 用于去抖

管理员 Dashboard
  → GET /analytics/summary | /trend | /top
  → PersonalStats 摘要 +「流量详情」tab
```

**边界**

- `viewCount++` 仍在 `post.service` / `page.service` 公开详情路径，本设计不改其语义
- Analytics 不写入 Post/Page 实体字段
- 查询接口仅 admin；上报接口公开（`AuthRoles` 允许匿名）但业务校验严格

## Data Model（建议）

### 日聚合 `analytics_daily_stat`

| 字段 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD`，Asia/Shanghai |
| `scope` | `site` \| `post` \| `page` |
| `scopeId` | site 用固定哨兵如 `0`；内容用实体 id |
| `pv` | 当日有效 PV |
| `uv` | 当日 UV |

唯一键：`(date, scope, scopeId)`

### 日 UV 去重 `analytics_daily_visitor`

| 字段 | 说明 |
|------|------|
| `date` | 上海日历日 |
| `scope` / `scopeId` | 同聚合 |
| `visitorId` | UUID 字符串 |

唯一键：`(date, scope, scopeId, visitorId)`  
保留策略：约 90 天可清理（MVP 可先不做定时任务，预留清理方法或文档说明）

### 短时去抖 `analytics_view_hit`（或等价）

| 字段 | 说明 |
|------|------|
| `visitorId` | |
| `contentType` | post/page |
| `contentId` | |
| `lastHitAt` | 上次有效计入时间 |

唯一键：`(visitorId, contentType, contentId)`  
判定：`now - lastHitAt < 30min` → 忽略本次（不增 PV；UV 亦不重复插入）

> 实现时可合并为更少表，但语义必须覆盖：日 UV 去重 + 30 分钟 PV 去抖。

## Report Flow

1. 解析 body，校验 UUID / enum / id
2. 加载 Post 或 Page；不存在或非 `published` → 静默成功或 400（建议 **204/200 空成功** 避免枚举未发布内容；或 404。推荐对非法目标直接 no-op 200，防探测）
3. 若请求带登录用户且 `user.id === authorId` → no-op
4. 计算上海 `today`
5. 查 `analytics_view_hit`：若在 30 分钟内 → no-op
6. 否则：
   - 更新/插入 hit 时间
   - site 与 content 两条聚合：`pv += 1`
   - 对 site 与 content 分别尝试插入去重行；插入成功则对应 `uv += 1`
7. 事务内完成，避免 PV/UV 撕裂

## Query API（草案）

| 方法 | 路径 | 权限 | 用途 |
|------|------|------|------|
| POST | `/analytics/view` | 公开 | 上报 |
| GET | `/analytics/summary` | admin | 今日 + 近 7 日站点 PV/UV |
| GET | `/analytics/trend?days=30` | admin | 站点日序列（缺日补 0） |
| GET | `/analytics/top?type=post\|page&days=30&limit=10` | admin | Top 榜 + 标题 |

响应经现有 `TransformInterceptor` 包成 `{ data, code, msg }`。

## Frontend

- `utils/visitor-id.ts`：读写 `applog_vid`
- 详情 hooks（`usePostDetail` / `usePageDetail`）在成功加载 published 内容后调用上报（失败静默，不影响阅读）
- `Dashboard.vue`：admin 时增加 tab；`PersonalStats` 拉取 summary；新组件如 `TrafficStats.vue` 拉 trend + top
- 趋势：轻量 SVG，无新依赖；视觉延续工具感列表，避免指标卡墙

## Compatibility

- 旧 `viewCount` 与仪表盘 PV **口径可不一致**（GET 每次 vs 30 分钟去抖 + 排除作者）——文档与 UI 不暗示二者相等
- TypeORM `synchronize: true` 下新表自动建；无数据迁移
- 历史流量从功能上线日起为零

## Trade-offs

| 选择 | 代价 |
|------|------|
| 独立上报 vs GET 副作用 | 多一次请求；分析更干净 |
| 只聚合不存全量事件 | 不能任意重算维度；MVP 足够 |
| localStorage visitorId | 清存储会变新 UV；可接受 |
| 不做限流 | 可被刷接口；个人站 + 去抖可接受 |

## Rollback

- 下线上报调用与 Analytics 模块即可；Post/Page `viewCount` 不受影响
- 可保留空表或删实体定义后由运维清表
