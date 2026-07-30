# 调研 Landing 3D 人物渲染方案

## Goal

为 Landing「生活切片」中的人物展示选择可落地的 Web 3D 渲染与角色模型来源，重点回答：有哪些主流引擎可选、哪些模型共享网站资源丰富、各自的授权与工程代价是什么。

## Confirmed Facts

- 前端使用 Vue 3 + Vite，目前没有 Three.js、Babylon.js、PlayCanvas、`<model-viewer>` 或其他 WebGL 依赖。
- 当前人物由纯 HTML/CSS 绘制，展示区域约 260px 高。
- 人物需要映射 Garmin 的四种状态：状态很好、状态不错、活着、挣扎中，并保留空闲态。
- Landing 强调安静、克制、低干扰；需要兼容移动端和 `prefers-reduced-motion`。
- 本任务只产出调研与选型建议，不修改产品代码。

## Requirements

1. 比较主流 Web 3D 方案的定位、Vue/Vite 集成、包体与运行成本、glTF/GLB/VRM 支持、动画能力和适用场景。
2. 调研提供丰富人物模型或动作资源的网站，区分免费下载、付费市场、自定义生成与开放许可资源。
3. 明确模型授权、署名、再分发、商业使用和用户生成模型条款等风险。
4. 给出适合当前 Landing 的分层推荐，并说明最小验证方案。
5. 最终方向采用可定制的个人化角色，而非通用现成模型快速上线。
6. 用户自行在 VRoid Studio 准备最终 `.vrm` 模型；实施不以官方示例模型代替最终资产验收。

## Acceptance Criteria

- [x] 至少覆盖 Three.js、Babylon.js、PlayCanvas 和 `<model-viewer>` 四类代表性方案。
- [x] 至少覆盖五个有角色或动画资源的模型平台，并提供官方来源链接。
- [x] 推荐结论能够回答“优先试哪个引擎、优先从哪里获得模型、什么情况下换另一方案”。
- [x] 调研结果保存在任务目录的 `research/` 下。

## Out of Scope

- 不购买或下载具体模型。
- 不实现 3D 渲染组件。
- 不决定最终人物美术风格或替换当前 CSS 人物。

## Key Decisions

- 角色来源采用 VRoid Studio 自建人物，确保形象辨识度与许可边界清晰。
- 运行时采用 Three.js + `@pixiv/three-vrm`，不以 `<model-viewer>`、Babylon.js 或 PlayCanvas 作为正式实现。
- VRM 模型及动作作为项目自有静态资产部署，不依赖第三方在线模型服务。
- 用户负责提供最终 VRM 模型并确认其中服装、发型、纹理等素材允许公开网站部署；工程实现负责运行时集成和许可记录落点。
- 必须保留静态海报或现有 CSS 人物作为加载失败、WebGL 不可用和低动态偏好的降级展示。

## Research

- [Web 3D 人物渲染与模型生态调研](./research/web-3d-character-options.md)
