# Landing 多邻国学习统计 — 技术设计

## 1. 架构边界

新增独立 `duolingo` 领域模块，不把第三方请求塞进 Landing、Weather 或 Analytics 模块：

```text
管理员系统设置
  → GET/PUT /duolingo/config（admin）
  → SYSTEM_DUOLINGO_CONFIG（JWT 脱敏读回）

公开 Landing
  → GET /duolingo/stats
  → DuolingoService（配置、缓存、single-flight、软降级）
  → DuolingoClient（第三方 HTTP）
  → Duolingo 未公开接口
```

职责：

- `@applog/common`：跨层配置、公开统计 DTO、脱敏常量和纯函数。
- Backend `duolingo`：认证请求、响应规范化、日期聚合、缓存与公开/admin API。
- Frontend API + Landing hook：读取公开 DTO，独立于文章和站点 Meta 请求降级。
- Landing component：只负责稳定视图模型的呈现，不解析第三方原始字段。
- Dashboard settings component：只负责管理员脱敏配置读写。

## 2. 跨层契约

### 2.1 管理配置

```ts
interface IDuolingoConfig {
  username: string;
  jwt: string;
  timeZone: string; // IANA，例如 Asia/Shanghai
  enabled: boolean;
}
```

- Key：`SYSTEM_DUOLINGO_CONFIG`。
- JWT 脱敏占位：复用统一 secret mask 值 `********`，但提供 Duolingo 命名的 helper，避免业务代码误用 Umami 语义。
- `GET /duolingo/config`：仅 admin；返回脱敏 JWT。
- `PUT /duolingo/config`：仅 admin；JWT 为空或为占位时保留旧值。
- 通用 `GET /config/:key` 对该 key 仅允许 admin 且必须脱敏。
- 通用 `setConfig` 禁止写该 key，防止占位符覆盖真实 JWT。
- `timeZone` 通过 `Intl.DateTimeFormat(..., { timeZone })` 验证；默认 `Asia/Shanghai`。
- `enabled` 为 false、用户名为空或 JWT 为空时视为未配置。

### 2.2 公开统计

```ts
interface IDuolingoLandingStats {
  streakDays: number | null;
  league: {
    tier: number;
    name: string;
  } | null;
  last7Days: {
    totalXp: number;
    totalLearningSeconds: number | null;
    days: Array<{
      date: string;
      xp: number;
      learningSeconds: number | null;
    }>;
  };
  languages: Array<{
    code: string;
    name: string;
    xp: number;
    share: number;
  }>;
  yearlyXp: {
    year: number;
    days: Array<{
      date: string;
      xp: number | null;
      future: boolean;
    }>;
  };
  fetchedAt: string;
  stale: boolean;
}
```

`GET /duolingo/stats` 返回 `IDuolingoLandingStats | null`：

- `null`：未配置、停用或从未成功获取。
- `stale: false`：缓存有效或刚刷新成功。
- `stale: true`：上游失败后返回上一次成功快照。
- 不返回 username、userId、JWT 或第三方原始对象。

## 3. 第三方请求与规范化

### 3.1 请求链

1. `GET /2017-06-30/users?username={username}` 解析 `users[0].id`。
2. `GET /2023-05-23/users/{userId}` 获取连胜、联赛和课程。
3. `GET /2017-06-30/users/{userId}/xp_summaries?startDate={date}` 获取最近 7 日和当年数据。

三个请求统一由 `DuolingoClient` 发出：

- `Authorization: Bearer <JWT>`。
- 固定 `Accept: application/json`。
- 使用明确的 Duolingo Android User-Agent，与调研验证路径一致。
- 单请求超时 8 秒。
- 错误只归一为无凭证的内部错误分类，例如 unauthorized、timeout、upstream、schema。
- 日志只记录阶段、HTTP 状态和无敏感标识的原因，不记录 headers、JWT 或完整响应。

`startDate` 取“当前年份 1 月 1 日”和“当前日期减 6 天”中更早者，覆盖跨年 7 日窗口且不拉取全历史。

### 3.2 字段解析

- 连胜：`site_streak ?? streak`，只接受非负有限整数。
- 联赛：按调研中的 fallback 链解析 tier，只接受 `0..9`。
- XP：`gainedXp ?? gained_xp`，非法值回退 0。
- 学习时间：`totalSessionTime ?? total_session_time`；有学习 summary 但字段缺失时记为 `null`，不进行 XP 估算。
- 课程：解析新旧字段，过滤明确的非语言 subject；按 `learningLanguage` 聚合。
- 语言名：优先使用 `Intl.DisplayNames('zh-CN', { type: 'language' })`，无法识别时回退课程标题或语言代码。

第三方响应先以 `unknown` 进入纯解析函数；解析器逐字段收窄，不在 controller、service 或 Vue 中散落类型断言。

## 4. 日期与统计口径

- 配置时区决定“今天”、7 日窗口、当前年份和 Unix 秒归属日期。
- 已是 `YYYY-MM-DD` 的字符串直接作为日历键，不先转 UTC。
- Unix 秒才使用配置时区格式化为 `YYYY-MM-DD`。
- 7 日 XP 缺日补 0。
- 没有 activity summary 的日期学习时间为 0；存在 summary 且时长字段缺失的日期为 `null`。
- 7 日总学习时间只在所有有活动日期均有可靠时长时求和，否则为 `null`。
- 年度日历从 1 月 1 日补到 12 月 31 日：
  - 已发生日期无 summary → `xp: 0, future: false`。
  - 未来日期 → `xp: null, future: true`。
- 语言 share 的分母是全部有效语言 XP；排序后仅输出前 2。

## 5. 缓存与并发

采用进程内缓存，与现有 Weather/Analytics 公共软降级模式一致，不新增数据库实体：

- 成功 TTL：30 分钟。
- 首次失败 TTL：1 分钟，避免公开流量持续击穿上游。
- 同配置并发请求共享一个 in-flight Promise。
- 缓存过期但已有成功快照时：
  - 立即返回 `stale: true` 的快照。
  - 后台触发一次 single-flight 刷新。
  - 刷新成功替换快照；失败保留旧快照。
- 管理员保存配置后清空缓存并递增 generation；旧 in-flight 响应不得回写新配置缓存。
- 进程重启后缓存丢失是可接受的；本期不做持久快照。

## 6. Landing 体验

新增 `LandingDuolingoStats.vue`，放在个人介绍之后、最近文章之前，使学习轨迹成为“认识作者”的延伸。

布局：

- 标题使用“最近在多邻国学习”一类个人叙事文案，不使用“数据面板”语言。
- 第一层为四个安静的排版指标：连胜、联赛、7 日经验、7 日学习时间。通过留白和细分隔线建立层级，不做四张彩色 KPI 卡。
- 第二层最多两张语言小卡片，显示语言名、累计 XP 和占比。
- 第三层为年度热力图，使用单色中性色阶和一个克制的绿色学习强调色；0、未来和正 XP 保持不同状态。
- 桌面直接展示完整年度；移动端热力图区域内部横向滚动并默认靠近当前周，不造成页面级横向滚动。
- 每个日期单元有可访问名称，例如“2026 年 7 月 27 日，42 XP”；整图附带文本摘要。
- `stale` 时只显示低干扰的“数据更新于……”说明，不展示技术错误。
- 返回 `null` 时整段隐藏；已有 Landing 区块不等待该请求。

热力图不引入图表依赖，使用 CSS Grid/SVG 或语义化元素实现；正 XP 以当年非零值的分位数映射 4 个强度等级。

## 7. 管理端体验

从现有大型 `SystemSettings.vue` 中抽出独立 `DuolingoSettings.vue`：

- 仅 admin 渲染和请求。
- 字段：启用开关、用户名、JWT 密码输入、IANA 时区。
- JWT 输入使用独立 draft；读回显示“已保存（留空不修改）”。
- 保存成功后提示“已更新，无需重新构建前端”。
- 401/403 不把 JWT 判为无效配置并清空；只显示可操作的更新提示。

## 8. 兼容、回滚与风险

- 无数据库 schema 迁移；新配置 key 不存在时功能保持关闭。
- 新公开接口和 Landing 区块均为增量，不改变现有页面数据链。
- 回滚可移除 `DuolingoModule` 注册和 Landing 组件；遗留配置行无消费者，不影响旧版本。
- Duolingo 接口未公开且可能漂移：解析器必须容错，tier 越界或关键字段缺失时软降级并记录无敏感信息的 warning。
- JWT 数据库明文存储是用户已接受的运维权衡，与现有 Umami 密码策略一致；不在本任务引入密钥加密基础设施。
- 页面应带有简短第三方说明，避免暗示与 Duolingo Inc. 的官方关联。

## 9. 预期文件边界

- Common：system config 类型、公开 stats 类型、常量、secret helpers、exports。
- Backend：`module/duolingo/`、system-config 特殊 key 保护、AppModule/module exports、单元测试。
- Frontend：`api/duolingo/`、Landing hook/component/utils、Dashboard 配置组件、类型直接复用 common。
- Specs：实现完成后新增 Duolingo 跨层契约，并在 frontend/backend/common index 中链接。
