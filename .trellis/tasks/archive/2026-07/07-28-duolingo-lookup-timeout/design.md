# Design: Duolingo lookup 超时韧性

## Boundaries

- 仅改 `packages/backend` 的 `DuolingoClient` / constants / 相关测试，以及 `.trellis/spec/backend/backend/duolingo-guidelines.md`。
- `DuolingoService` 缓存、generation、soft-degrade 保持不变；userId 缓存放在 Client，不泄漏到公开 API。
- `setConfig` 已清 service cache；Client 侧 userId cache 以 `username` 为 key，配置换用户名自然 miss，无需 service 反向调用。

## Data flow（改后）

```
getLandingData(config, startDate)
  → resolveUserId(username, jwt)
       cache hit? 用缓存 id
       else GET /2017-06-30/users?username=…  (timeout/retry) → 写入 cache
  → Promise.all(
       GET /2023-05-23/users/{id},
       GET …/xp_summaries?startDate=
     )  (各自 timeout/retry)
  → { user, summaries }
```

## HTTP resilience

| 项 | 现值 | 目标 |
| --- | --- | --- |
| 单请求 timeout | 8_000 ms | 15_000 ms |
| timeout 重试 | 无 | 同 URL/params/headers 再发 1 次；两次间隔约 200–300ms |
| 可重试 kind | — | 仅网络超时（无 response 且 `ECONNABORTED`/`ETIMEDOUT`） |
| 不可重试 | — | 401/403、有 HTTP status 的 upstream、schema |

实现形态：Client 内私有 `requestGet(url, config, stage)`，统一计时、重试与 `normalizeError`。

## userId cache

- 结构：`Map<string, string>`（username → userId），进程内、无 TTL。
- 命中条件：key 与当前 `config.username` 完全一致（trim 后与现配置一致即可；沿用 config 已 trim 的假设则直接用）。
- 失败不写缓存；lookup schema 失败不污染缓存。
- 进程重启后自动清空，可接受。

## Logging

失败 warn 示例：

`Duolingo 请求失败: stage=lookup, kind=timeout, status=unknown, elapsedMs=15012, attempt=2`

禁止：JWT、Authorization、完整 URL query 中的敏感值、响应 body。

## Compatibility / rollback

- 对外 API 无 breaking change。
- 回滚：恢复 constants 与 Client 即可；无迁移。
- 风险：更长超时在上游完全挂死时会拖慢首次冷请求（最多约 15s × 2 ≈ 30s）；single-flight 已限制并发击穿。失败缓存 1 分钟仍保护上游。

## Spec sync

更新 `duolingo-guidelines.md`：

- 单请求超时 15s
- timeout 最多重试 1 次
- Client 可缓存 username→userId 并跳过重复 lookup
