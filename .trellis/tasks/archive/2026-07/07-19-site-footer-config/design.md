# Design: 建站日期与备案号

## Approach

在现有 `ISystemBaseConfig` 上增加两个可选字段，随 `SYSTEM_BASE_CONFIG` 一并读写。管理端在「站点信息」分组追加表单项；前台 `Footer` 基于 `useSystemStore.config` 渲染次要信息，并用 `setInterval(1000)` 驱动运行时间。

## Data Model

扩展 `@applog/common`：

```ts
export interface ISystemBaseConfig {
  title: string;
  description: string;
  allowUserLogin: boolean;
  allowComment: boolean;
  /** 建站日期，ISO 日期 `YYYY-MM-DD`；空字符串或未设置表示不展示 */
  siteFoundedDate?: string;
  /** 备案号原文；空字符串或未设置表示不展示 */
  icpFilingNumber?: string;
}
```

- 存储：仍为一条 JSON 配置，无迁移脚本；旧配置缺字段时按「未配置」处理（`?? ''`）
- 初始化默认值：`siteFoundedDate: ''`、`icpFilingNumber: ''`（与现有 init 对齐，便于表单绑定）
- 校验：前端不做强校验；空串视为未配置。非法日期字符串时 Footer 不展示运行时间

## Admin UI（`SystemSettings.vue`）

- 放在「站点信息」分组，`description` 之后：
  - 建站日期：shadcn-vue **Popover + Calendar + Button** 日期选择器（非原生 `input[type=date]`）；存储仍为 `YYYY-MM-DD` 字符串，与 `@internationalized/date` 的 `CalendarDate` 互转；支持清除按钮将值置为 `''`
  - 备案号：`<Input type="text" placeholder="如 粤ICP备xxxxxxxx号" />`
- `initializeFormData` / 默认对象补齐两字段
- 保存路径不变（整份 `ISystemBaseConfig` JSON）

## Footer UI（`Footer.vue`）

```
[Row 1 — 原有布局，不变]
  Copyright © {year} {title}. | Nav links + 管理 | (optional buildInfo)

[Row 2 — 次要信息块，仅当至少一项有值；作为 Row1 的兄弟节点，勿嵌套进版权单元格]
  桌面 sm+：备案? · 运行时间?（同行；备案在前；单项无多余分隔符）
  移动 <sm：备案? 与 运行时间? 各一行（备案在上）
```

- 备案：`<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">`
- 运行时间：`computed` 依赖 `now`（`ref` + `setInterval`），组件 `onUnmounted` 清理
- 起算：`new Date(`${siteFoundedDate}T00:00:00`)`（本地时区）
- 差值：`Math.max(0, now - founded)`，再拆天/时/分/秒（未来日期显示全 0，避免负数）
- 工具函数：`packages/frontend/src/utils/site-uptime.ts`（纯函数，便于单测）

## Backend

- `initializeSystem` 默认配置补两字段
- 无 API / DTO 结构变更（仍是字符串 JSON）
- 读路径无需改：缺字段对旧数据兼容

## Risks / Edge Cases

| 场景 | 处理 |
|------|------|
| 旧配置无新字段 | 视为未配置 |
| 清空后保存 | 存 `''`，Footer 隐藏 |
| 建站日在未来 | 时长钳制为 0 |
| 非法日期 | 不展示运行时间 |
| 定时器泄漏 | `onUnmounted` clearInterval |

## Non-Goals

- 服务端 SSR 时间同步
- 备案号正则校验
- 独立配置 key / 多语言文案
