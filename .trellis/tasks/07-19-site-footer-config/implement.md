# Implement: 建站日期与备案号

## Order

1. **common** — 扩展 `ISystemBaseConfig`；重新 build `@applog/common`
2. **backend** — `initializeSystem` 默认配置补 `siteFoundedDate` / `icpFilingNumber`
3. **frontend UI deps** — `pnpm dlx shadcn-vue@latest add calendar popover`（含 native-select 依赖）
4. **frontend admin** — `SystemSettings.vue`：Popover+Calendar 日期选择器 + 备案号表单与初始化
5. **frontend utils** — `site-uptime.ts`：由起算日 + now 计算文案 / 分段
6. **frontend footer** — `Footer.vue`：Row1 保持版权+导航；Row2 次要信息 + 每秒刷新

## Files

| 文件 | 变更 |
|------|------|
| `packages/common/src/types/system-config.ts` | 新增可选字段 |
| `packages/backend/src/module/system-config/system-config.service.ts` | init 默认值 |
| `packages/frontend/src/components/ui/calendar/*` | shadcn Calendar |
| `packages/frontend/src/components/ui/popover/*` | shadcn Popover |
| `packages/frontend/src/components/ui/native-select/*` | Calendar 依赖 |
| `packages/frontend/src/pages/user/Dashboard/components/SystemSettings.vue` | 日期选择器 + 备案号 |
| `packages/frontend/src/utils/site-uptime.ts` | 新建：时长计算与文案 |
| `packages/frontend/src/components/Layout/Footer.vue` | 两行结构 + 展示逻辑 |

## Verification

- [ ] 管理端可保存 / 清空两项（日期选择器可清除）
- [ ] 仅备案、仅日期、两项皆有、皆无四种 Footer 表现正确
- [ ] Row1 版权与导航仍同行；Row2 桌面同行分隔、移动两行
- [ ] 运行时间每秒跳动
- [ ] 备案点击新开 `https://beian.miit.gov.cn/`
- [ ] 旧配置（无新字段）不报错、不误展示

## Spec / Context

实现前跑 `trellis-before-dev`，覆盖 `common` / `backend` / `frontend` 相关 checklist。
