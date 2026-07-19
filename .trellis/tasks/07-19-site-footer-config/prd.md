# 管理端建站日期与备案号配置

## Goal

在管理端系统设置中新增「建站日期」与「备案号」两项配置；配置后，前台页脚分别展示实时运行时间（精确到秒）与可点击备案号链接。

## Confirmed Facts（代码已证实）

- 站点基础配置统一落在 `ISystemBaseConfig`（`SYSTEM_BASE_CONFIG`），管理入口为 Dashboard `SystemSettings.vue`
- 前台页脚为 `packages/frontend/src/components/Layout/Footer.vue`
- 管理端建站日期使用 shadcn-vue Popover + Calendar（非原生 date input）
- 初始化默认配置在 `system-config.service.ts` 的 `initializeSystem`
- 前台通过 `useSystemStore` 解析并缓存 `ISystemBaseConfig`

## Requirements

- [x] 管理端「系统设置」新增「建站日期」：shadcn Calendar 日期选择器（可清除）
- [x] 管理端「系统设置」新增「备案号」：文本输入框
- [x] 配置建站日期后，前台页脚展示站点运行时间，精确到秒，前端每秒刷新
- [x] 运行时间文案：`本站已运行 {天} 天 {时} 时 {分} 分 {秒} 秒`
- [x] 起算时刻：所选日期在**本地时区**的 `00:00:00`
- [x] 配置备案号后，前台页脚展示备案号；点击跳转 `https://beian.miit.gov.cn/`（新标签页）
- [x] 页脚 Row1 保持版权 + 导航同行；Row2 次要信息：桌面同行（备案在前 · 运行时间在后）；移动端两行（备案在上）
- [x] 两项均为可选：未配置 / 清空后不展示对应内容；皆空则不渲染次要信息块
- [x] 字段并入现有 `ISystemBaseConfig` 一并读写保存

## Decisions

| 决策 | 结论 |
|------|------|
| 运行时间文案 | `本站已运行 {天} 天 {时} 时 {分} 分 {秒} 秒` |
| 建站日起算 | 所选日期本地 `00:00:00`（仅日期选择器） |
| 日期选择器 | shadcn-vue Popover + Calendar；存储 `YYYY-MM-DD` |
| 页脚结构 | Row1 版权+导航（原布局）；Row2 备案/运行时间 |
| 页脚次要信息（桌面） | `备案号 · 本站已运行…`（备案在前；单项无多余分隔符） |
| 页脚次要信息（移动） | 两行：备案在上、运行时间在下 |
| 备案链接 | 新标签打开 `https://beian.miit.gov.cn/` |
| 空值行为 | 可选；清空保存后隐藏对应项 |
| 存储位置 | 扩展 `ISystemBaseConfig`，不新增独立 SYSTEM_ key |

## Out of Scope

- 不新增独立系统配置 key
- 不做备案号格式校验
- 不在服务端计算运行时间
- 不提供带时分秒的建站时间选择器

## Acceptance Criteria

- [ ] 管理员可在系统设置中保存 / 清空建站日期与备案号
- [ ] 已配置建站日期时，Footer 可见运行时间且每秒更新
- [ ] 已配置备案号时，Footer 可见备案链接，点击新标签打开工信部站点
- [ ] Row1 版权与导航同行；Row2 桌面备案在前、同行 ` · ` 分隔；移动两行（备案在上）
- [ ] 未配置项不出现；两项皆空时无次要信息块
- [ ] 刷新后仍正确展示（来自系统配置）

## Notes

- 任务目录：`.trellis/tasks/07-19-site-footer-config`
- 状态：in_progress（check PASS；spec 已更新；待用户确认后 commit / finish-work）
- Spec 已写入：
  - `.trellis/spec/common/shared/package-boundaries.md`（`ISystemBaseConfig` site meta 跨层契约）
  - `.trellis/spec/frontend/frontend/component-guidelines.md`（Calendar 日期选择 + Footer 两行约定）

