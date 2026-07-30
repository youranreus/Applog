# Landing 个人化 VRM 人物实施计划

## Phase 1: Asset prototype

- [ ] 用户在 VRoid Studio 中创建自有角色，并提供最终可部署的 VRM 与授权信息；未收到前不以示例模型替代最终验收。
- [ ] 生成静态 poster 图，作为加载与失败降级。
- [ ] 准备四类状态动画，完成 VRM humanoid 重定向验证。
- [ ] 在独立原型中确认模型、材质、透明背景和动作均可正确渲染。

## Phase 2: Runtime integration

- [ ] 为前端增加 Three.js 与 `@pixiv/three-vrm` 依赖。
- [ ] 在 `LandingTodayStatus` 内实现局部、懒加载的 VRM 渲染组件。
- [ ] 实现 Garmin 状态到 AnimationClip 的稳定映射和交叉淡化。
- [ ] 实现 ResizeObserver、视口暂停、页面后台暂停和卸载清理。
- [ ] 保留 poster/CSS fallback 与可访问状态文本。

## Phase 3: Visual and performance pass

- [ ] 在桌面、移动端验证构图，不恢复卡片、边框或分割线。
- [ ] 验证 loading、unavailable、stale、无状态和五种动画状态。
- [ ] 验证 `prefers-reduced-motion`、WebGL 不可用和模型加载失败。
- [ ] 检查模型与代码分块体积、离屏 RAF、控制台错误和内存释放。
- [ ] 若成本超出阅读体验预算，优化资产；仍不合格则保持 fallback。

## Validation

```bash
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
git diff --check
```

还需执行真实浏览器桌面/移动端视觉回归、减少动态效果回归和低性能设备抽查。

## Rollback Point

在删除或停用现有 CSS 人物前设置明确回滚点。VRM 方案未通过美术、性能和降级验收时，不替换线上默认人物。
