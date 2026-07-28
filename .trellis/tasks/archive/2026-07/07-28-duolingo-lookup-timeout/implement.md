# Implement: Duolingo lookup 超时韧性

## Checklist

- [x] 将 `DUOLINGO_HTTP_TIMEOUT_MS` 改为 `15_000`；如需，增加 `DUOLINGO_HTTP_RETRY_DELAY_MS`（约 250）
- [x] 在 `DuolingoClient` 抽取带计时/重试的 GET helper；lookup / details 共用
- [x] 增加 username→userId 内存缓存；lookup 成功后写入，同 username 跳过
- [x] warn 日志增加 `elapsedMs` 与 `attempt`
- [x] 扩展 `duolingo.client.spec.ts`：超时重试成功、两次超时、缓存跳过 lookup、换 username 重新 lookup
- [x] 更新 `.trellis/spec/backend/backend/duolingo-guidelines.md` 合同条款
- [x] Landing：多邻国统计移到最近文章下方、Slogan 上方
- [x] 跑 backend 相关单测与文件级 lint

## Validation

```bash
# 在 packages/backend 下（或等效路径）：
node --require ts-node/register --require tsconfig-paths/register --test \
  test/duolingo.client.spec.ts test/duolingo.service.spec.ts \
  test/duolingo-config.service.spec.ts test/duolingo.utils.spec.ts
pnpm --filter @applog/backend run build
# 可选：冷刷新观察日志不再高频 stage=lookup timeout
curl -sS --max-time 40 "http://localhost:4000/v1/duolingo/stats"
```

## Review gates

- 不记录凭证；错误 kind 仍为 `unauthorized|timeout|upstream|schema`
- Service 层行为（TTL / single-flight / stale / generation）无回归
- 不改前端

## Rollback

还原 `duolingo.constants.ts`、`duolingo.client.ts`、测试与 guidelines 即可。
