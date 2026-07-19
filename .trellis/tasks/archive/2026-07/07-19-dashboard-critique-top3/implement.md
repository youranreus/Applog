# Implement Plan

## Order

1. **harden** — `SystemSettings.vue`、`SystemInitialize.vue`、`useSystemInitialize.ts`、`Dashboard.vue`（通知 + 确认）
2. **quieter / distill** — `PersonalStats.vue`（列表行 + 链接，去掉彩虹卡与多余装饰）
3. **polish** — 死代码清理（tabs icon）、错误 Retry、`aria-invalid` 误标、跑 detect 验证

## Validation

- `node .agents/skills/impeccable/scripts/detect.mjs --json packages/frontend/src/pages/user/Dashboard`
- `pnpm --filter @applog/frontend run type-check`（或至少相关文件无新增类型错误）
