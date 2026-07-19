# PRD: Dashboard critique Top3 修复

## Background

`$impeccable critique /user/dashboard` 得分 **12/40 (Poor)**。用户选择：

- 优先：反馈与危险操作（P0 harden）
- 语气：保持工具感，去掉 AI 彩虹卡
- 范围：只修 Top 3

Critique 快照：`.impeccable/critique/2026-07-19T06-20-38Z__es-frontend-src-pages-user-dashboard-dashboard-vue.md`

## Goal

让 `/user/dashboard` 成为可信、可行动的作者工具页：高风险操作有确认与可见反馈；统计区不再是 SaaS 彩虹指标卡墙。

## In Scope (Top 3)

1. **[P0] 可见反馈** — 系统设置保存、系统初始化的成功/失败通过 `layoutStore.notify`（Sonner）展示；初始化错误可在 UI 内联看到。
2. **[P0] 危险操作确认** — 「初始化系统」、关闭「允许用户登录」（及同类权限变更）保存前需确认对话框并说明后果；设置区分「站点信息」与「访问与互动」。
3. **[P1] PersonalStats 降噪** — 去掉彩色圆标与等权 Card 墙；改为工具感列表/行 + 链到 `/user/post`、`/user/page`、`/user/comment`。

## Out of Scope

- 全页品牌文案改写（clarify：「用户控制面板」→ 写作空间口吻）
- 全页 token 换肤（非 Top 3）
- P2 完整 a11y 大扫（可顺手修 `aria-invalid` 误标，但不扩 scope）

## Acceptance Criteria

- [x] 保存系统配置成功/失败有 toast，不再只靠 `console.log`
- [x] 初始化成功有 toast；失败有内联错误，可再次尝试
- [x] 初始化前有确认对话框（含简短后果说明）
- [x] 关闭「允许用户登录」并保存前有确认
- [x] PersonalStats 无 `text-*-600` 彩虹圆标 / 四宫格 Card
- [x] 统计项可导航到对应管理列表
- [x] `detect.mjs` 对 Dashboard 目录不再报 `ai-color-palette`

## Non-goals

不改变后端 API；不重做侧栏 IA。
