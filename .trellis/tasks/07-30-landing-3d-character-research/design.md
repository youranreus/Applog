# Landing 菲比动画角色技术设计

## Architecture

保持现有组件边界，只替换 `TodayCharacter.vue` 内部人物渲染：

```text
GarminTodayStatus | null
          ↓
状态动作配置（纯 TypeScript）
          ↓
帧计时器 / reduced-motion 策略
          ↓
固定比例 DOM Sprite viewport
          ↓
本地 spritesheet.webp
```

不修改 `LandingTodayStatus/index.vue`、API、Pinia 或共享类型。

## Asset Contract

- 静态资产：菲比 `spritesheet.webp`
- 上游标识：`feibi--vanfff`
- Codex Pet 版本：v1
- 图集：1536×1872，8 列×9 行
- 单元格：192×208
- 透明背景：是
- 上游 SHA-256：`a9557926850b37c2b877c8777896366435c6b190f77876dff7d0ca296edca04a`

资源保存在前端公开静态目录下的角色专用子目录，并附来源/许可说明。运行时 URL 使用 Vite 的基础路径兼容方式，不能假设应用总部署在域名根目录。

## State And Animation Contract

| Garmin 状态 | 菲比行 | 动作 | 用途 |
|---|---:|---|---|
| 无数据 | 6 | waiting | 等待今日快照 |
| 状态很好 | 4 | jumping | 明确的高能量反馈 |
| 状态不错 | 3 | waving | 轻快但不过度兴奋 |
| 活着 | 0 | idle | 安静的基础状态 |
| 挣扎中 | 5 | failed | 疲惫/失败语义 |

动作配置记录行号、有效帧数与逐帧时长，数据以仓库 `generate-pet-previews.py` 的 v1 合约为基准。状态切换重置到新动作首帧。首帧同时作为该动作组的静止态；非悬停时等待约 7 秒后只播放一轮，鼠标悬停期间连续播放，移出后立即回到首帧。

配置和“给定当前帧求下一帧”的逻辑放在页面本地 TypeScript 模块，便于 Node 单元测试。只有一处消费，不增加跨页面抽象。

## Rendering

- 使用固定 `aspect-ratio: 192 / 208` 的角色 viewport，尺寸由容器约束。
- Sprite 元素使用 `background-image`，`background-size: 800% 900%`。
- 水平位置按 `column / 7`、垂直位置按 `row / 8` 计算百分比，避免缩放后出现像素偏移。
- 使用 Vue 响应式状态和两个可取消 `setTimeout` 分别管理逐帧播放与静止间隔；组件卸载、动作切换、鼠标移出或 reduced-motion 变化时先清理旧 timer。
- 角色 viewport 收紧为桌面约 196px、移动约 176px，同时保留 192:208 比例。
- 图片预加载成功后再显示动画表面；失败时保持静态降级。

## Motion And Accessibility

- 使用 `matchMedia('(prefers-reduced-motion: reduce)')` 或项目已有 VueUse 能力监听动态变化。
- reduced-motion 下固定动作首帧，不创建后续 timer。
- 外层继续使用当前状态的 `aria-label` 和 `role="img"`；Sprite 本身标为装饰，避免重复朗读。
- 不新增交互、按钮或说明文字。

## Failure And Fallback

- 资源加载失败只切换组件内部视觉状态，不抛出未处理异常。
- 降级表面保持相同宽高，避免布局跳动，可使用简洁静态轮廓或中性占位。
- 失败不改变状态标题、分数、指标或 stale/unavailable 行为。

## Compatibility And Performance

- 不新增 npm 依赖，不创建 WebGL/Canvas 上下文。
- 单一 WebP 当前约 2.1MB；实现阶段评估无损转有损/近无损优化是否可在无明显视觉损失下降低体积，优化后必须保留视觉检查与新校验值。
- 静态资源使用长期缓存时应依靠构建文件名或显式版本路径；更新资产时同步更新来源记录。
- 支持当前项目覆盖的现代浏览器；WebP 已在目标浏览器范围内可用。

## Licensing And Attribution

记录：

- 仓库：`https://github.com/legeling/awesome-codex-pet`
- 资产：`pets/feibi--vanfff`
- 作者：`vanfff`
- 原始来源：`https://codex-pets.net/share/feibi`
- 固定上游版本：`510d293f675cc6d166e3851b3b836fbcf5155e0b`
- 当前许可陈述：公开 Codex Pets 投稿，但仓库未提供明确的再分发许可证

该陈述不足以自动推导 AppLog 的商业网站再分发权。实现可在本地完成，但合并到公开部署分支前需获得作者确认或改用许可明确的替代资产。

## Rollback

变更集中在 `TodayCharacter.vue`、页面本地配置/测试和角色静态资产目录。若视觉、性能或许可未通过，可还原组件并删除该资产目录，不涉及后端或数据迁移。
