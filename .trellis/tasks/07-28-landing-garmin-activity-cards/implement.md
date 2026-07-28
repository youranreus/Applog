# Implement Checklist — Landing Garmin 活动卡片

## Order

1. **common** — 扩展 `IGarminLandingActivity`：`calories`、`locationName`；rebuild `@applog/common`
2. **worker** — `models` / `normalize` / `repository` / `TYPE_LABELS` + 单测
3. **backend** — Entity 列、`GarminService` map、`garmin.service.spec.ts`
4. **frontend**
   - utils：距离/消耗格式化（距离 null → 空/不展示）、presentation hook
   - `ActivityTypeCover`（静态 SVG 映射）
   - `LandingGarminStats`：上下分栏卡片、横滑 + 溢出渐变、icon 指标行、skeleton
   - 更新 `garmin-utils.spec.mjs`
5. **验证** — worker pytest、backend garmin spec、frontend garmin utils + type-check/lint 相关包

## Validation Commands

```bash
# worker
cd workers/garmin-sync && python -m pytest tests/test_normalize.py tests/test_sync.py -q

# backend
pnpm --filter @applog/backend exec node --import tsx --test test/garmin.service.spec.ts

# frontend utils
pnpm --filter @applog/frontend exec node --test test/garmin-utils.spec.mjs

# types
pnpm --filter @applog/common run build
pnpm --filter @applog/frontend run type-check
```

（具体 test runner 以包内既有脚本为准；若命令有出入以实现时仓库脚本为准。）

## Risky Files

- `workers/garmin-sync/src/garmin_sync/repository.py` — SQL 列必须与 TypeORM 实体一致
- `packages/common/src/types/garmin.ts` — 前后端契约
- `LandingGarminStats/index.vue` — 布局重写，注意 a11y（scroll region `tabindex`、封面 `aria-label`）

## Rollback

- 新列可空，回滚前端即可降级展示；worker 停写新列不影响旧读路径
- 勿在公开 DTO 中临时透传未校验地点字符串

## Pre-start Notes

- 不拉足球热力 API
- 不改 Duolingo / 其它 Landing 区块
- 同步后才有新中文标签与消耗/地点；UI 须容忍 null
