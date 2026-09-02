# 执行计划：Landing AI Cost 切换到 Tokscale

依据 [`design.md`](design.md)。按顺序执行，每步结束时跑对应的校验命令。

## 阶段 0：准备

- [ ] 从 tokscale 线上抓一份 fixture 存到 `packages/backend/test/fixtures/tokscale-profile.json`（脱敏：`user.id` / `avatarUrl` 置空，保留 `contributions` 结构），作为归一化与契约测试的固定输入
  ```bash
  curl -s "https://tokscale.ai/api/users/youranreus?period=month" -o /tmp/tokscale-raw.json
  ```
- [ ] fixture 里必须覆盖：多软件同日、单软件多模型、`cacheWrite = 0`、`reasoning = 0`

## 阶段 1：common（先做，backend/frontend 都依赖它）

- [ ] 新建 `packages/common/src/types/tokscale.ts`：`ITokscaleModelUsage` / `ITokscaleClientUsage` / `ITokscaleLandingStats`
- [ ] 新建 `packages/common/src/constants/tokscale.ts`：`TOKSCALE_CLIENT_DISPLAY_NAMES`（完整表见 `research/tokscale-api.md`）+ `TOKSCALE_PROFILE_BASE_URL`
- [ ] `packages/common/src/types/system-config.ts`：`ISystemBaseConfig` 增加 `tokscaleUsername?: string`；删除 `IWakaTimeConfig`
- [ ] `packages/common/src/constants/system-config.ts`：删除 `SYSTEM_WAKATIME_CONFIG_KEY` / `WAKATIME_API_KEY_MASK` / `SYSTEM_CONFIG_KEYS.WAKATIME_CONFIG`
- [ ] 删除 `packages/common/src/types/wakatime.ts`、`packages/common/src/utils/wakatime-config.ts`
- [ ] 更新 `packages/common/src/index.ts` 的导出（去 wakatime、加 tokscale）
- [ ] **确认 `duolingo-config.ts` 的 `isValidIanaTimeZone` 未被连带删除**（wakatime-config 曾复用它）

```bash
pnpm --filter @applog/common run build
```

## 阶段 2：backend 新增

- [ ] `src/module/tokscale/tokscale.constants.ts`
      —— `TOKSCALE_PROFILE_URL_TEMPLATE`、`TOKSCALE_HTTP_TIMEOUT_MS = 15_000`、`TOKSCALE_HTTP_RETRY_DELAY_MS = 250`、`TOKSCALE_SUCCESS_CACHE_TTL_MS = 10 * 60 * 1000`、`TOKSCALE_FAILURE_CACHE_TTL_MS = 60 * 1000`、`TOKSCALE_PERIOD = 'month'`
- [ ] `src/module/tokscale/tokscale.client.ts`
      —— `TokscaleClient.getUserProfile(username): Promise<unknown>`；axios + `maxRedirects` 允许 308；错误归类为 `not_found / ambiguous / rate_limited / timeout / upstream`；日志不含 body 与 username
- [ ] `src/module/tokscale/tokscale.utils.ts`
      —— `buildTokscaleLandingStats(raw: unknown): ITokscaleLandingStats`、`TokscalePayloadSchemaError`；选日 / 过滤 `<synthetic>` / legacy `modelId` 兜底 / 排序，逻辑见 design §4
- [ ] `src/module/tokscale/tokscale.service.ts`
      —— `getLandingStats()` 同步读；`refreshFromStoredConfig()` 每次重读 `getBaseConfigRaw().tokscaleUsername` 并与快照 username 比对，不一致则清空快照 + `generation += 1`；single-flight / TTL / 失败抑制 / stale fallback / `onModuleInit` 定时器 + `unref()` / `onModuleDestroy` 清理
- [ ] `src/module/tokscale/tokscale.controller.ts`
      —— `@Controller({ path: 'tokscale', version: [VERSION_NEUTRAL, '1'] })`，只有 `@Get('stats')`，公开，无 `@AuthRoles`
- [ ] `src/module/tokscale/tokscale.module.ts` —— imports `SystemConfigModule`
- [ ] 在 `src/module/index.ts` 与 `src/app.module.ts` 注册 `TokscaleModule`

## 阶段 3：backend 删除 WakaTime

- [ ] 删除 `src/module/wakatime/` 整个目录
- [ ] `src/module/index.ts` / `src/app.module.ts` 摘掉 `WakaTimeModule`
- [ ] `src/module/system-config/system-config.service.ts` 清理（design §8 列了具体成员），注意 `isWakaTimeConfigKey` 在 `getConfig` / `batchGetConfigs` / `setConfig` 三处有分支
- [ ] 删除 4 个 wakatime backend 测试文件

## 阶段 4：backend 测试

- [ ] `test/tokscale.client.spec.ts` —— 请求 URL 与 `period=month` 参数、超时重试一次后放弃、404/409/429 分类、错误与日志不含 username
- [ ] `test/tokscale.utils.spec.ts` —— 用 fixture 断言：选中最后一个有 token 的日子、跳过零 token 尾日、`<synthetic>` 被过滤、legacy `modelId` 兜底、软件/模型按 cost 降序且稳定、`totalTokens == tokens 五项之和`、contributions 非数组或全零时抛 `TokscalePayloadSchemaError`
- [ ] `test/tokscale.service.spec.ts` —— 公开读不触发上游、single-flight、TTL 过期后 `stale: true`、失败抑制 60s、username 变更清空快照、username 为空时不请求上游且快照为 `null`、定时器 `unref` 与清理
- [ ] 公开边界断言：`JSON.stringify(snapshot)` 不含 `avatarUrl` / `rank` / `mcpServers` / `sessionCount` / `devices`

```bash
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
```

## 阶段 5：frontend 新增

- [ ] `src/api/tokscale/index.ts` —— `getTokscaleStats()`
- [ ] `src/pages/Landing/hooks/useLandingTokscaleStats.ts` —— `useRequest(getTokscaleStats, { immediate: true })`，失败折叠为 `null`
- [ ] `src/pages/Landing/tokscale-utils.ts` —— `formatTokenCount` / `formatUsd` / `formatTokscaleDay` / `isTokscaleDataDelayed` / `getTokscaleTokenShares`（签名见 design §7）
- [ ] `src/pages/Landing/components/tokscale/TokscaleUsageCard.vue` —— 周期行 / hero / 五段分布条 + legend / 软件-模型对齐列表
- [ ] `src/pages/Landing/components/LandingTokscaleStats.vue` —— kicker `AI Cost` + 标题 `开发状态` + skeleton + 延迟提示
- [ ] `src/pages/Landing/index.vue` —— 用 `LandingTokscaleStats` 替换 `LandingWakaTimeStats`，位置不变（Duolingo 之后、Slogan 之前），保持 `v-if="loading || stats"`

## 阶段 6：frontend 删除 + 配置入口

- [ ] 删除 `src/api/wakatime/`、`hooks/useLandingWakaTimeStats.ts`、`Landing/wakatime-utils.ts`、`LandingWakaTimeStats.vue`、`Landing/components/wakatime/`
- [ ] 删除 `Dashboard/components/WakaTimeSettings.vue` 及 `SystemSettings.vue` 中的 import 与挂载
- [ ] `Dashboard/components/LandingSettingsFields.vue` 新增 `tokscaleUsername` 输入框，紧邻「天气城市」，文案参照它：标签「Tokscale 用户名」，说明「服务端会拉取该用户的公开 AI 用量；留空则首页不展示 AI Cost」
- [ ] 确认 `SystemSettings.vue` 保存 base config 时带上了新字段（检查它是整体透传还是逐字段列举）
- [ ] 删除 `test/wakatime-utils.spec.mjs`

## 阶段 7：frontend 测试

- [ ] `test/tokscale-utils.spec.mjs`
  - `formatTokenCount`：0 / 999 / 1_234 / 25_901_073 / 1_234_567_890
  - `formatUsd`：0 / 0.0047 / 0.0448 / 10.719 / 1234.5
  - `formatTokscaleDay`：今天 / 昨天 / 更早
  - `isTokscaleDataDelayed`：0/1/3/4 天，边界在 3
  - `getTokscaleTokenShares`：正常分布 / 全零 / 单项独占
  - 源码回归断言：Landing 里 `LandingTokscaleStats` 位于 Duolingo 之后 Slogan 之前；卡片不再出现 WakaTime 相关标识；模型行使用 tabular-nums

```bash
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run lint
```

## 阶段 8：spec 与收尾

- [ ] 新建 `.trellis/spec/backend/backend/tokscale-guidelines.md`（沿用 duolingo/wakatime 的 7 段结构：Scope、Signatures、Contracts、Validation & Error Matrix、Good/Base/Bad、Tests Required、Wrong vs Correct）
- [ ] 删除 `.trellis/spec/backend/backend/wakatime-guidelines.md`
- [ ] `.trellis/spec/backend/backend/index.md`：替换 checklist 行与索引表行
- [ ] 全仓搜残留：`rg -i wakatime` 应只剩 `.trellis/tasks/archive/` 和 `docs/research/wakatime-landing-data.md`
- [ ] 手动验证：本地起后端，`curl localhost:4000/tokscale/stats`，确认返回结构且不含禁用字段；起前端看 Landing 渲染

## 全量校验

```bash
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run lint
pnpm build
git diff --check
```

## 风险点与回滚

| 风险 | 触发信号 | 处理 |
|---|---|---|
| `system-config.service.ts` 删 WakaTime 分支时误伤 Duolingo / Umami / Notification 的脱敏逻辑 | `wakatime-config.service.spec.ts` 删掉后没有回归网 | 删除前先跑一遍现有 system-config 相关测试，改完再跑一次；三个 `isWakaTimeConfigKey` 调用点逐个确认只摘 WakaTime 那一项 |
| `common/src/index.ts` 导出漏改导致 backend/frontend 编译炸 | `pnpm --filter @applog/common run build` 通过但下游 build 失败 | 阶段 1 完成后立即跑 backend + frontend 的 type-check，不要攒到最后 |
| `SystemSettings.vue` 逐字段列举 base config，新字段保存不上 | 后台改了 username 但刷新后回退 | 阶段 6 明确检查这一点，必要时补字段 |
| 上游改 schema | 归一化抛 schema error，Landing 整段消失 | 已在 utils 层用 fixture 锁契约；线上表现为软降级而非报错，可接受 |

最危险的两个文件：`packages/backend/src/module/system-config/system-config.service.ts`（删除操作，牵连其他集成）和 `packages/common/src/index.ts`（导出面，牵连所有下游）。这两处改完立刻验证，不要和其他改动混在一个未验证的批次里。
