# 修复 Duolingo lookup 超时导致统计经常失败

## Goal

降低 Landing 多邻国统计因上游 `lookup` 阶段超时而频繁失败的概率，在不改变公开 DTO 与软降级语义的前提下提高冷刷新成功率。

## Background（已复现）

- 日志：`warn [DuolingoClient] Duolingo 请求失败: stage=lookup, kind=timeout, status=unknown`
- 冷缓存请求 `GET /v1/duolingo/stats` 曾在约 8.05s 后返回 `null`（贴合当前 `DUOLINGO_HTTP_TIMEOUT_MS = 8000`）
- 同环境稍后冷刷新约 9.97s 可成功返回完整统计；命中成功缓存约 50–70ms
- 公开账号 lookup 约 0.6–2s 稳定；问题是配置账号整条链路抖动 + 单次 8s 超时过紧 + 无重试

## Requirements

1. 单次 Duolingo HTTP 请求超时从 8s 提高到 **15s**（与现有 Umami 客户端超时对齐）。
2. 对 `timeout` 类失败（`ECONNABORTED` / `ETIMEDOUT`）在同一阶段 **最多重试 1 次**（短退避后重发）；`unauthorized` / `schema` 不重试。
3. 在 `DuolingoClient` 内按 `username` 内存缓存已解析的 `userId`，后续刷新跳过 lookup；`username` 变化或显式清空时失效。
4. 失败 warn 日志增加耗时（ms），仍不得输出 JWT、headers、响应正文或用户名以外的敏感信息（用户名可不进日志；阶段与 kind 足够）。
5. 公开接口契约不变：仍返回 `IDuolingoLandingStats | null`；成功/失败缓存 TTL、single-flight、stale 语义不变。
6. 单元测试覆盖：超时重试成功、超时耗尽仍为 `timeout`、userId 缓存跳过二次 lookup、username 变更后重新 lookup。

## Out of Scope

- 持久化 userId 到 DB 或 system-config
- 更换 Duolingo 数据源或抓取架构
- 调整成功缓存 30 分钟 / 失败抑制 1 分钟（除非实现中发现必须联动）

## Scope addendum（2026-07-28）

- Landing 区块顺序调整：多邻国统计放在「最近文章」下方、Slogan 上方（原为 Profile 与最近文章之间）。

## Acceptance Criteria

- [ ] 冷刷新在上游偶发延迟 8–12s 时，lookup 不再因旧 8s 预算必然失败
- [ ] 单次超时后会再试一次；两次皆超时才向上抛出 `kind=timeout`
- [ ] 同一 username 第二次 `getLandingData` 不再发起 lookup 请求
- [ ] 现有公开/admin 行为与 DTO 不变；密钥仍不进日志
- [ ] 相关 backend 单测通过；`duolingo-guidelines` 合同同步超时/重试/userId 缓存约定
- [ ] Landing 顺序为 Profile → 最近文章 → 多邻国统计 → Slogan

## Notes

- 诊断结论：上游可达但延迟抖动大，8s 单次超时位于 P99 边缘。
- 用户已口头认可方向：15s 超时 + 1 次重试 + userId 缓存 + 耗时日志。
