---
target: /user/dashboard
total_score: 12
p0_count: 2
p1_count: 2
timestamp: 2026-07-19T06-20-38Z
slug: es-frontend-src-pages-user-dashboard-dashboard-vue
---
# Critique — /user/dashboard

**Target:** packages/frontend/src/pages/user/Dashboard/Dashboard.vue (+ PersonalStats, SystemSettings, SystemInitialize)
**Score:** 12/40 (Poor) · **P0:** 2 · **P1:** 2 · **P2:** 1

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | 保存成功仅 console.log；初始化失败无 UI |
| 2 | Match System / Real World | 1 | 「用户控制面板」像运维后台，不像写作空间 |
| 3 | User Control and Freedom | 2 | Tab 可切；设置无取消；危险开关无确认 |
| 4 | Consistency and Standards | 1 | DESIGN.md token 与 gray utility / 彩虹 Card 断裂 |
| 5 | Error Prevention | 1 | 初始化与 allowUserLogin 无确认；aria-invalid 误标 |
| 6 | Recognition Rather Than Recall | 2 | 有文字标签；指标卡无跳转上下文 |
| 7 | Flexibility and Efficiency | 1 | 无快捷键、无从指标进管理页 |
| 8 | Aesthetic and Minimalist Design | 1 | 彩虹指标卡 + 双重标题噪音 |
| 9 | Error Recovery | 1 | 「加载失败」无 Retry；错误不可见 |
| 10 | Help and Documentation | 1 | FieldDescription 同义反复；初始化无后果说明 |
| **Total** | | **12/40** | **Poor** |

## Anti-Patterns Verdict

**LLM:** 是 AI/SaaS 仪表盘套路——四宫格 rainbow icon circles、text-gray-900 工具栈、emoji 占位、「控制面板」文案。
**Detector:** 1 条 `ai-color-palette` @ PersonalStats.vue:81 (`text-purple-600`)。同文件 blue/green/orange 未报——检测器低估了彩虹卡组问题。
**Overlay:** 未注入（browser MCP 无法持有 tab）。

## Overall Impression

结构（侧栏身份 + 竖向 Tab）方向对，但视觉与文案落在「通用 CMS 后台」而不是 AppLog「干净·锐利」的写作空间。最大机会：拆掉 vanity metric 卡墙，换成作者口吻的一行概览 + 可行动跳转，并把保存/危险操作做成可信反馈。

## What's Working

1. 竖向 Tabs 把只读统计与设置分开，IA 比单页堆砌清楚。
2. 空配置时 `SystemInitialize` 闸门挡住半残设置，方向正确。
3. 设置区 Field/Switch/Input 选型尚可，有改造基础。

## Priority Issues

### [P0] 保存与初始化无可见反馈
- **Why:** 高风险配置变更后无法确认是否生效。
- **Fix:** layoutStore.notify / Sonner；初始化错误内联展示。
- **Suggested command:** `$impeccable harden`

### [P0] 危险操作无确认
- **Why:** 关登录/初始化可误触，作者焦虑。
- **Fix:** 确认对话框 + 后果说明；权限与站点信息分区。
- **Suggested command:** `$impeccable harden`

### [P1] 指标卡 AI/SaaS 造型 vs 品牌
- **Why:** 撞 PRODUCT 反例（SaaS card walls）；与公开站气质断裂。
- **Fix:** 去彩色圆标与等权 Card；改一行概览 + 链到写作管理；用 frost 分层。
- **Suggested command:** `$impeccable quieter` / `$impeccable distill`

### [P1] 文案与 token 错位
- **Why:** 「欢迎来到用户控制面板」+ gray-900 不像 AppLog。
- **Fix:** 作者口吻文案；接入 carbon/frost/ash/apple-blue。
- **Suggested command:** `$impeccable clarify` + `$impeccable colorize`（或 quieter）

### [P2] 错误态不可恢复 / a11y 误标
- **Why:** 死胡同错误；全局 aria-invalid 污染。
- **Fix:** Retry；按字段校验；aria-live。
- **Suggested command:** `$impeccable harden`

## Persona Red Flags

**Alex:** 指标无跳转；保存无反馈会连点；整页被初始化挡住。
**Sam:** 标题层级跳 h1→h3→h2；色分指标；状态不进 DOM。
**作者本人:** 「控制面板」+ vanity 卡像别人的 CMS；「系统标题」不像站点名。

## Cognitive Load

6/8 checklist failures → High。设置屏 5 项并行决策。

## Minor Observations

- tabs[].icon 死数据；双重标题；admin-page-container 与前台尺度割裂；Card rounded-xl 偏 shadcn 默认。

## Questions to Consider

1. 若去掉四张指标卡，只留一行可点击概览，作者是否更愿意打开这里？
2. 「系统设置」是否应降为稀有入口而非日常 Tab？
3. allowUserLogin 关掉时公开站会发生什么——为何不说？
4. 去掉顶导后，本页还像 AppLog 吗？
5. 「初始化系统」为何用运维动词对待作者？
