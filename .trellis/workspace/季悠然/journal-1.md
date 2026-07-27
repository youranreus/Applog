# Journal - 季悠然 (Part 1)

> AI development session journal
> Started: 2026-07-19

---



## Session 1: shadcn-vue Apple 主题定制

**Date**: 2026-07-19
**Task**: shadcn-vue Apple 主题定制
**Branch**: `master`

### Summary

按 DESIGN.md 完成 Input/Button/Badge/Checkbox/Select/Tabs 与全局字体主题；修复编辑页 overflow 裁切 ring；Select 改为 popper；规范写入 component-guidelines

### Main Changes

- 后台系统设置新增分钟级时间选择器，与日历控件共同编辑建站时间。
- 建站时间保存为本地 `YYYY-MM-DDTHH:mm`，兼容旧 `YYYY-MM-DD` 值。
- 表单和页脚共用统一解析器，严格拒绝非法日期、时分与多余后缀。
- 更新 Trellis 前端控件规范和跨层系统配置契约。

### Git Commits

| Hash | Message |
|------|---------|
| `d10fb7b` | (see git log) |
| `27100dc` | (see git log) |
| `aaa7cf0` | (see git log) |

### Testing

- `pnpm --filter @applog/common run build`
- `pnpm --filter @applog/frontend run type-check`
- `pnpm --filter @applog/frontend run build-only`
- `pnpm --filter @applog/backend run build`
- 相关文件 oxlint / ESLint 通过；建站时间解析边界断言通过。

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Markdown 编辑器 shadcn 改造

**Date**: 2026-07-19
**Task**: Markdown 编辑器 shadcn 改造
**Branch**: `master`

### Summary

MarkdownEditor 改用外侧 Tabs + Textarea，预览同框 550px；aria-invalid 替代旧校验 API；Tabs 放大与选中 hover 修复；全局滚动条透明轨道圆角；更新 frontend component-guidelines。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `7824f81` | (see git log) |
| `943741c` | (see git log) |
| `eb6e3be` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Dashboard 概览 Top3 修复与 toast 打磨

**Date**: 2026-07-19
**Task**: Dashboard 概览 Top3 修复与 toast 打磨
**Branch**: `master`

### Summary

按 critique Top3 完成概览页：保存/初始化反馈与危险操作确认、统计列表降噪、Apple 分段切换与「概览」文案；统一 Sonner 无图标 toast；并写入前端通知/组件约定。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `ca1491f` | (see git log) |
| `7bb575c` | (see git log) |
| `cf85bc6` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 文章页面管理列表 UX 打磨

**Date**: 2026-07-19
**Task**: 文章页面管理列表 UX 打磨
**Branch**: `master`

### Summary

完成 admin-list-ux-polish：列表页头/搜索/空错态/表格/分页打磨，check 通过并提交

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `b0f2c12` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: 修复文章阅读次数不更新

**Date**: 2026-07-19
**Task**: 修复文章阅读次数不更新
**Branch**: `master`

### Summary

定位 Post 详情未自增 viewCount；公开已发布才计数，管理端 includeUnpublished 不计数（Post/Page 对齐），并写入 backend database-guidelines。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `eeeb809` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: 建站日期与备案号配置

**Date**: 2026-07-20
**Task**: 建站日期与备案号配置
**Branch**: `master`

### Summary

管理端新增建站日期（shadcn Calendar）与备案号；Footer 展示实时运行时间与备案链接；同步 common/backend 契约与 Trellis spec。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `6ba7090` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: 博客 PV/UV 统计与后台展示

**Date**: 2026-07-23
**Task**: 博客 PV/UV 统计与后台展示
**Branch**: `master`

### Summary

实现站点/内容级 PV/UV：独立上报、日聚合、管理员概览摘要与流量详情；补充 analytics code-spec 后归档任务。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `4be33b6` | (see git log) |
| `33efd3c` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: 接入 Umami 升级流量统计

**Date**: 2026-07-26
**Task**: 接入 Umami 升级流量统计
**Branch**: `feat/umami-analytics-integration`

### Summary

将 Dashboard 流量改为自建 Umami：管理端配置对接、公开 tracker 引导、后端代理查询 Views/Visitors/趋势/热门/设备/地域；停用旧自建 PV/UV 上报；更新 analytics 与跨层 spec。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `9e0da36` | (see git log) |
| `c935d23` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: 重构 Landing 页面阅读体验

**Date**: 2026-07-26
**Task**: 重构 Landing 页面阅读体验
**Branch**: `master`

### Summary

完成 Landing 窄栏个人首页重构：新增可配置标题、副标题、Slogan、天气城市及社交链接，接入服务端天气与 Umami 在线人数，复用站点运行时间，并完成响应式布局、降级策略和代码规范更新。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `1aa0fe2` | (see git log) |
| `ed4ad8e` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: 建站时间精确到分钟

**Date**: 2026-07-26
**Task**: 建站时间精确到分钟
**Branch**: `master`

### Summary

后台系统设置新增分钟级时间选择器，建站时间以本地 YYYY-MM-DDTHH:mm 保存并兼容旧日期格式；统一表单与页脚解析校验，补充跨层配置契约。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `037a46e` | (see git log) |
| `b7dd60d` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: 访客鼠标位置展示

**Date**: 2026-07-26
**Task**: 访客鼠标位置展示
**Branch**: `master`

### Summary

实现同路径访客鼠标的低频同步、随机身份与绝对定位展示；修复滚动后视口坐标漂移，统一为文档坐标，并完成双标签页回归、构建、类型检查和后端单测。

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `6bec37f` | (see git log) |
| `7174e52` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: 博客评论与 Typecho 评论迁移

**Date**: 2026-07-27
**Task**: 博客评论与 Typecho 评论迁移
**Branch**: `master`

### Summary

实现公开评论树、游客待审核撤回、登录用户直接发布、Gravatar、评论锚点与后台审核；提供 Typecho comments-only 幂等迁移、隐私边界和跨层回归测试。

### Git Commits

| Hash | Message |
|------|---------|
| `f86c331` | (see git log) |

### Status

[OK] **Completed**


## Session 13: 评论框与评论迁移入口

**Date**: 2026-07-27
**Task**: 评论框与评论迁移入口
**Branch**: `master`

### Summary

重构公开评论表单与内嵌发送编辑器；在后台评论管理页新增固定 comments-only 的 Typecho 迁移弹窗、统计反馈与成功刷新；补充测试和评论迁移契约。

### Git Commits

| Hash | Message |
|------|---------|
| `63994b9` | (see git log) |

### Status

[OK] **Completed**


## Session 14: 支持文章与页面评论迁移

**Date**: 2026-07-27
**Task**: 支持文章与页面评论迁移
**Branch**: `master`

### Summary

扩展评论为文章/页面双目标，完成 Typecho 页面评论迁移、共享前端评论区、管理端目标展示、跨层测试与规范更新。

### Git Commits

| Hash | Message |
|------|---------|
| `0d495ef` | (see git log) |

### Status

[OK] **Completed**


## Session 15: 对齐后台评论管理表格样式

**Date**: 2026-07-27
**Task**: 对齐后台评论管理表格样式
**Branch**: `master`

### Summary

将评论管理表对齐文章/页面 admin-content-table 视觉；时间列前置仅日期，目标列去掉父级/后代数，状态改为圆点；并补充 frontend component-guidelines 约定。

### Git Commits

| Hash | Message |
|------|---------|
| `ae11764` | (see git log) |
| `665a46b` | (see git log) |

### Status

[OK] **Completed**
