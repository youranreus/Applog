# Landing Garmin 展示调整执行计划

## Ordered Checklist

1. 更新 `@applog/common` Garmin 契约，加入卡片白名单指标结构并完成 common build。
2. 更新 worker 的室内骑行详情重解析范围/parser version，补充 worker 单测，确认请求预算不变。
3. 更新 NestJS Landing 映射，从 `detailData` 安全投影 metrics；补充 DTO、null 降级和隐私回归测试。
4. 更新前端格式化与活动类型预设，为无路线活动生成最多 5 项非空卡片指标，单独处理 `indoor_cycling` 的踏频文案。
5. 调整 pointer tilt，仅移除 transform 中的 scale 并保留有界倾斜、设备守卫和复位行为；随后按有效路线输出按钮或静态数据卡，确保静态卡无详情事件和误导 aria。
6. 修复详情弹窗宽度、grid 最小尺寸、单栏断点和分段行窄屏布局。
7. 更新 Garmin 跨层 spec，使其不再要求所有活动统一方形封面/三行 body，并记录路线/无路线交互契约。
8. 执行自动化验证，然后启动本地页面完成四个目标视口的视觉校验；发现溢出则回到步骤 6。

## Validation Commands

```bash
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run type-check
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
cd workers/garmin-sync && python3 -m unittest discover -s tests
```

按项目可用脚本启动 backend/frontend 后，对 1440×900、1024×768、768×1024、390×844 截图检查：路线卡、无路线卡、骑行、室内骑行、跑步详情、操场跑分段详情。

## Risky Files and Rollback Points

- `packages/common/src/types/garmin.ts` 与 `packages/backend/src/module/garmin/garmin.service.ts` 必须同步，避免契约漂移。
- `workers/garmin-sync/src/garmin_sync/repository.py` 的 parser version 会触发有界历史重解析；保持 batch size 不变，异常时可回退 version/type whitelist。
- `GarminActivityCard.vue` 根元素语义变化可能影响共享元素动画和 focus restoration；详情只从路线按钮进入并保留 source element。
- `GarminActivityDetailDialog.vue` 的 `:deep` 样式可能受 Dialog primitive class 顺序影响，必须通过浏览器 computed layout 验证。

## Pre-Start Review Gate

- PRD 的指标优先级、不可交互语义和视口验收已获用户确认。
- `prd.md`、`design.md`、`implement.md` 一致且没有 blocking open question。
- 用户在看到最终规划摘要后的下一条消息中明确批准实施，才运行 `task.py start`。
