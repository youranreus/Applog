# Landing 菲比动画角色

## Goal

用 `legeling/awesome-codex-pet` 的 `feibi--vanfff` 二维 Sprite Sheet 替换 Landing「生活切片」中现有的纯 CSS 人物，以较低的运行成本呈现与 Garmin 今日状态对应的动画角色。

## Confirmed Facts

- 前端使用 Vue 3 + Vite，人物组件位于 `packages/frontend/src/pages/Landing/components/LandingTodayStatus/TodayCharacter.vue`。
- 人物区域桌面端约 260px 高，移动端约 230px 高；外层已提供今日状态的可访问文本。
- 菲比是 Codex Pet v1 资产：`spritesheet.webp` 为 1536×1872、8 列×9 行、每格 192×208、带透明通道。
- 九行标准动作依次为 `idle`、`running-right`、`running-left`、`waving`、`jumping`、`failed`、`waiting`、`running`、`review`，每行动画帧数和时序不同。
- 官方安装脚本只把资产写入 `~/.codex/pets/feibi--vanfff/`，不能作为 Web 项目的运行时依赖。
- `submission.json` 只声明作者允许收入 Awesome Codex Pet gallery，没有给出明确的商业网站再分发许可。

## Requirements

1. 将菲比的 `spritesheet.webp` 作为项目自有静态资源部署，不从 `~/.codex` 读取，不在浏览器运行安装脚本，也不从 GitHub 热链。
2. 实现稳定的 Garmin 状态到菲比动作映射：
   - 无数据 → `waiting`
   - 状态很好 → `jumping`
   - 状态不错 → `waving`
   - 活着 → `idle`
   - 挣扎中 → `failed`
3. 按上游 v1 规格裁切 8×9 网格，并使用每行动作自己的有效帧数和时序；状态切换后从目标动作首帧开始。
4. 四个 Garmin 有值状态分别映射到四组动作素材；每组首帧作为该状态的静止态。
5. 角色默认保持静止，只在约 7 秒间隔后播放一轮动作；鼠标悬停期间播放动作，移出后回到静止首帧。
6. 保持当前 `TodayCharacter` 组件接口和 `LandingTodayStatus` 数据流，不修改后端、Garmin API 或共享状态类型。
7. `prefers-reduced-motion: reduce` 下停在对应动作的稳定首帧，不运行循环定时器。
8. 图片加载失败时显示安静的静态占位/降级表面，不能影响今日指标和 Landing 其余内容。
9. 角色尺寸比初版更紧凑，在桌面与移动视口保持完整、清晰、不裁头脚、不挤压右侧状态数据。
10. 保留菲比作者、来源 URL、资产版本与校验信息；公开部署前必须确认网站使用与再分发许可。

## Acceptance Criteria

- [ ] Landing 正常加载时显示菲比，不再显示现有 CSS 拼装人物。
- [ ] 五种输入状态分别播放计划中的五个动作，状态变化不需要重新下载图片。
- [ ] 四个 Garmin 有值状态分别使用独立动作组，并以该组首帧作为静止态。
- [ ] 非悬停时仅按间隔播放单轮动作，悬停时播放，移出后恢复静止。
- [ ] Sprite Sheet 只作为一个静态资源加载，不新增 Three.js、Canvas/WebGL 或动画库依赖。
- [ ] 减少动态效果下人物保持静止，且无持续动画定时器。
- [ ] 资产加载失败时状态文本和指标仍正常可见，控制台无未处理错误。
- [ ] 桌面与移动端视觉检查通过，角色在固定展示区域内无明显裁切、变形或布局跳动。
- [ ] 状态动作映射与帧配置有聚焦的单元测试。
- [ ] 前端 lint、类型检查、单元测试和生产构建通过。
- [ ] 项目中保存资产来源、作者、上游 commit/校验值和许可待确认说明。

## Out of Scope

- 不安装 Three.js、`@pixiv/three-vrm` 或其他 3D 运行时。
- 不实现自由移动、鼠标追踪、16 方向视线或跨页面宠物系统。
- 不修改菲比原画、补绘动作或升级为 Codex Pet v2。
- 不让后台用户上传或切换角色。
- 本任务不代替作者对公开网站部署的授权；未确认前只完成本地集成与技术验收。

## Key Decisions

- 放弃 VRM/Three.js，采用菲比 v1 Sprite Sheet。
- 资产进入前端静态资源目录，官方 Codex 安装脚本不进入 AppLog 构建或运行流程。
- 动作配置抽成小型、可测试的页面本地模块；Vue 组件负责按配置推进帧。
- 许可确认是生产发布门槛，不阻塞本地实现。
