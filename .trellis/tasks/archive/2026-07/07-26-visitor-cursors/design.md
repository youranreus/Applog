# 访客鼠标技术设计

## Architecture

功能由一个后端短期在场状态模块和一个前端全局透明展示层组成：

1. 前端在 `sessionStorage` 创建并保存访客键、四位 ID 和色板颜色。
2. 前端仅在支持的公开路由监听鼠标移动，在内存中覆盖保存最新相对文档坐标。
3. 前端通过单个 `POST /visitor-cursor/sync` 请求上报本访客状态，同时取回同路径其他访客。
4. 后端在进程内存 `Map` 中保存短期状态，同步时清理过期项、upsert 当前访客，再返回最近活跃的 20 位其他访客。
5. 前端用应用根容器内覆盖整篇文档的绝对定位透明层承载鼠标，容器与子节点都不接收指针事件。

## Backend Contract

### Request

`POST /visitor-cursor/sync`

```ts
interface SyncVisitorCursorRequest {
  visitorKey: string; // UUID，标签页会话内稳定
  displayId: string;  // /^[0-9A-F]{4}$/
  color: string;      // #RRGGBB
  pagePath: string;   // 以 / 开头，最长 512
  x: number;          // 文档横向位置，0..1
  y: number;          // 文档纵向位置，0..1
}
```

### Response

```ts
interface VisitorCursorResponse {
  visitorKey: string;
  displayId: string;
  color: string;
  x: number;
  y: number;
  updatedAt: string;
  expiresInMs: number; // 服务端剩余有效期
}
```

返回值为 `VisitorCursorResponse[]`，已排除请求者，按 `updatedAt` 降序，上限 20。全局响应包装与现有 NestJS 应用保持一致。

## State and Cleanup

- 内存键使用 `pagePath + visitorKey` 组合，允许路由切换后同一会话在新路径上拥有独立状态。
- 每次同步先删除 15 秒前的记录；不使用 TypeORM 持久化，避免把短期在场信息变成长期访客记录。
- 服务重启会清空所有鼠标；下一个 5 秒周期内自动恢复，对本功能可接受。
- 实现按单实例部署设计。未来若需水平扩容，可在保持 API 合同的前提下替换为 Redis TTL 存储。

## Frontend Lifecycle

- 全局组件依据路由名或 pathname 判断是否启用。禁用时立即清空远程鼠标并停止定时器。
- `mousemove` 以 `clientX/Y + scrollX/Y` 计算文档位置，并按完整文档宽高归一化；事件只更新内存坐标，不直接发起网络请求。
- 同步请求完成前不重入；排队请求与路由/可见性触发也受统一的 5 秒请求起始间隔限制。
- 前端依据服务端返回的 `expiresInMs` 扣除完整请求耗时后安排保守清理，不会因网络传输或收到响应而延长 15 秒期限。
- `sessionStorage` 身份通过 `BroadcastChannel` 认领，避免 opener 创建的新标签页沿用被复制的身份。
- 错误被本地吞掉，保留当前展示直到下次成功或超过服务端声明的剩余有效期。
- 路由切换和 `visibilitychange` 恢复可见会尝试立即同步，但仍共享节流与重入保护。

## Visual Design

- 图标使用简单 SVG 鼠标指针轮廓，尺寸约 18–20px，线宽与现有线性图标接近。
- ID 使用 12px SF Pro Text/system sans，不加卡片、背景或阴影，仅通过颜色和字重建立识别。
- 色板避开现有 Apple Blue 的主交互语义，选择在白色/Frost 背景上仍可辨识的中深色。
- 展示层在具有定位上下文的应用根容器中使用 `position: absolute`，属于全局非交互装饰；使用语义化 z-index token，低于 modal/toast/tooltip。

## Compatibility and Risks

- 四位展示 ID 存在碰撞可能；内部识别始终使用 UUID，因此碰撞只影响显示，不会覆盖状态。
- 进程内存方案不支持多实例共享；已明确为本期权衡，因为它最符合短期、不持久的隐私边界。
- 前端不将访客同步错误接入全局通知，避免一个氛围功能打断阅读。

## Bug Analysis: 滚动后远程鼠标错位

- **根因类别**：跨层合同与隐式假设。采集端用视口坐标、接口只声明数值范围、渲染端使用固定视口，三层一致地实现了错误语义。
- **测试缺口**：首次浏览器验证覆盖了不同视口尺寸，但没有把滚动作为独立变量，因而没有断言文档锚点稳定。
- **修复机制**：采集端统一为归一化文档坐标；应用根容器提供定位上下文；透明层改为 `absolute` 并使用百分比文档位置。
- **防复发**：跨层规范明确坐标空间，并要求双标签页滚动回归；通用跨层检查新增空间数据的坐标系与滚动锚点检查。
- **系统性检查**：当前访客鼠标是唯一跨层空间数据消费者，未发现其他同类实现需要迁移。

## Rollback

回滚只需从 `App.vue` 移除全局展示组件，并从 `AppModule`/模块导出中移除访客鼠标模块。无数据库结构或历史数据需要回滚。
