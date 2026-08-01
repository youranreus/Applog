# Landing 菲比动画角色实施计划

## Phase 1: Asset And Contract

- [x] 从固定的上游版本下载 `feibi--vanfff/spritesheet.webp`，校验尺寸、透明通道和 SHA-256。
- [x] 将资产放入 `packages/frontend/public/` 下的角色专用目录。
- [x] 添加来源、作者、上游版本、校验值和许可待确认记录。
- [x] 保留上游原始质量，不做有损压缩；浏览器验收确认透明边缘在当前浅色背景正常。

## Phase 2: Testable Animation Model

- [x] 创建页面本地 Sprite 配置模块，定义 v1 网格、九行动作帧时序和 Garmin 五态映射。
- [x] 提供纯函数计算动作配置、下一帧与背景位置。
- [x] 添加 Node 单元测试，覆盖五态映射、循环边界和网格位置。

## Phase 3: Vue Integration

- [x] 用 Sprite viewport 替换 `TodayCharacter.vue` 现有 CSS 拼装人物。
- [x] 实现图片预加载、动作切换重置、逐帧 timer 和卸载清理。
- [x] 实现 reduced-motion 动态监听并确保该模式不持续调度 timer。
- [x] 实现加载失败降级和稳定尺寸，保留现有可访问名称。
- [x] 调整桌面/移动样式，使 192:208 角色完整落在现有展示区域。
- [x] 将持续循环改为“首帧静止、间隔播放一轮、悬停播放、移出复位”。
- [x] 将角色缩小为桌面约 196px、移动约 176px。

## Phase 4: Verification

- [x] 通过映射测试验证无数据、状态很好、状态不错、活着、挣扎中五种输入。
- [x] 通过组件生命周期实现与质量复查验证图片失败、快速切换、卸载和 reduced-motion。
- [x] 运行 1440px 桌面与 390px 移动端视觉检查，无裁切、文本重叠、布局跳动或横向溢出。
- [x] 浏览器控制台无错误，Sprite Sheet 使用本地 URL，未引入新运行时依赖。
- [x] 在 `ASSET.md` 和任务元数据中记录公开部署前的许可确认状态。

## Validation

```bash
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
git diff --check
```

使用本地开发服务器执行真实浏览器桌面/移动端截图检查，并验证 `prefers-reduced-motion` 与资源失败场景。

## Risky Files And Rollback

- `packages/frontend/src/pages/Landing/components/LandingTodayStatus/TodayCharacter.vue`
- 新增的页面本地 Sprite 配置模块及单测
- `packages/frontend/public/` 下的菲比资产目录

上述范围可独立回滚。许可、视觉或体积验收失败时恢复现有 CSS 人物，不影响 Garmin 数据链路。
