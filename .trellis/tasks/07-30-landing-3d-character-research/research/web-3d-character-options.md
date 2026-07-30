# Web 3D 人物渲染与模型生态调研

> 调研日期：2026-07-30。平台规模、价格和许可可能变化；选中具体模型后仍需保存购买/下载当日的许可快照。

## 结论先行

对 AppLog Landing 的单人物、约 260px 展示区域，优先级如下：

1. **Three.js + glTF/GLB**：首选。生态最广，能精确控制多个 AnimationClip、状态切换、交叉淡化、灯光和渲染生命周期；也能通过 `@pixiv/three-vrm` 扩展 VRM。
2. **`<model-viewer>` + GLB**：最快验证方案。一个 Web Component 就能展示模型和播放内嵌动画，浏览器兼容与海报图降级成熟；复杂状态机、动画混合和角色定制不如 Three.js 灵活。
3. **Babylon.js**：能力全面、工具链强，适合未来扩展成互动场景；当前单人物用途会引入超出需求的引擎概念和体积。
4. **PlayCanvas**：适合希望通过可视化编辑器协作、托管完整 Web 3D 场景或做游戏化互动的团队；当前 Vue 页面中的局部人物展示不需要平台级编辑器。

推荐的资源管线：

- 写实或通用人物：**Sketchfab / CGTrader / TurboSquid 找 rigged low-poly 模型 → Mixamo 自动绑定或添加动作 → Blender 清理与合并动画 → 导出压缩 GLB → Three.js 加载**。
- 二次元、个人化角色：**VRoid Studio 自建或 VRoid Hub 找允许下载/使用的 VRM → `@pixiv/three-vrm` + Three.js**。
- 只想快速判断视觉是否合适：先选一个许可清晰、已带动画的 GLB，用 `<model-viewer>` 做一次孤立原型；方向确认后再决定是否升级到 Three.js。

## 渲染方案对比

| 方案 | 定位 | 模型与动画 | Vue/Vite 集成 | 优点 | 主要代价 | 本项目适合度 |
|---|---|---|---|---|---|---|
| [Three.js](https://threejs.org/) | 底层 Web 3D 渲染库 | glTF/GLB 成熟；AnimationMixer、clip 混合；VRM 有社区扩展 | 可直接写组合式组件；也可用 TresJS | 最大生态、示例多、按需控制强、与模型市场管线兼容最好 | 相机、灯光、渲染循环、资源释放和降级需自行管理 | **最高** |
| [Babylon.js](https://www.babylonjs.com/) | 完整 Web 3D 引擎 | glTF、骨骼、动画组、物理、材质与调试工具完整 | npm 集成直接，但引擎对象模型较完整 | 工具链强、官方 Sandbox/Playground、WebGPU 路线积极 | 对单人物展示偏重；学习与运行面更大 | 中 |
| [PlayCanvas](https://playcanvas.com/) | 开源引擎 + 在线编辑平台 | glTF、动画状态图、场景编辑和资产管线 | 可用 npm Engine，也可发布编辑器项目后嵌入 | 可视化协作强；官方说明支持 WebGPU、WebGL2，MIT 开源 | 平台工作流和场景体系对局部组件过度 | 中低 |
| [`<model-viewer>`](https://modelviewer.dev/) | Google 提供的 3D/AR Web Component | 直接展示 GLB/glTF；支持内嵌动画、相机控制、海报图和 AR | Vue 模板中像 HTML 元素一样使用 | 上手最快、默认交互/浏览器兼容/懒加载和 fallback 省心 | 不是通用引擎；复杂动画状态机、骨骼控制和高度定制受限 | **高，适合原型** |
| [A-Frame](https://aframe.io/) | 声明式 WebXR 框架 | glTF 与动画组件 | 自定义元素可嵌入 Vue | VR/AR 场景上手快 | Landing 非 XR，抽象层与 DOM 组件体系没有收益 | 低 |
| [React Three Fiber](https://r3f.docs.pmnd.rs/) | Three.js 的 React renderer | 继承 Three.js 生态 | 项目是 Vue，不适配 | React 项目体验优秀 | 为此引入 React 不合理 | 排除 |

### Three.js 是否需要 Vue 封装

- [TresJS](https://tresjs.org/) 能以 Vue 声明式组件组织 Three.js 场景，适合页面中有多处 3D 或团队希望统一 Vue 写法。
- 当前只有一个局部人物组件，直接使用 Three.js + `GLTFLoader` 更容易控制依赖和生命周期；不必为了“Vue 化”增加一层封装。

## 模型、角色与动作资源平台

### 第一梯队：最值得先看

| 平台 | 资源特点 | 模型丰富度 | 授权与使用提示 | 适合本项目的方式 |
|---|---|---:|---|---|
| [Sketchfab](https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount) | 大型社区；可筛 Downloadable、Animated，人物风格跨度大 | 很高 | **逐模型许可**，常见 CC BY、CC BY-NC、CC0 等；下载不等于可商用。需保存作者、许可、署名文本和下载日期 | 找低模、风格化、已绑定或带动画的 GLB/FBX |
| [Adobe Mixamo](https://www.mixamo.com/) | 免费人物、自动骨骼绑定和大量 humanoid 动作 | 动作极高，角色中等 | Adobe FAQ 显示持 Adobe ID 可免费使用且无需 CC 订阅；通常可用于个人、商业和非营利项目，但不应把原始角色/动画文件作为独立资产再分发。中国区账号/服务可用性受限 | 给自有或市场模型补 idle、walk、celebrate、tired 动作 |
| [VRoid Hub](https://hub.vroid.com/en) + [VRoid Studio](https://vroid.com/en/studio) | 二次元 VRM 社区 + 免费角色制作工具 | 二次元角色高 | Hub 上**每个角色的下载、改编、商业用途、署名条件可不同**；不要把“可预览”当成“可下载”。自建角色最清晰 | 创建有个人辨识度的角色，使用 VRM 管线 |
| [CGTrader Characters](https://www.cgtrader.com/3d-models/character) | 免费与付费市场，官方页面提供 rigged、animated、low-poly、PBR 等筛选 | 很高；调研时页面显示 32 万+ Character 条目 | 核对每件商品许可、格式和是否包含骨骼/动画；“royalty-free”通常不允许原始资产再销售或公开下载 | 找质量更稳定的付费 game-ready / low-poly 人物 |
| [TurboSquid Characters](https://www.turbosquid.com/Search/3D-Models/character) | 老牌专业模型市场，写实与影视级资源多 | 很高；调研时官方页称 14 万+ Character 模型 | 标准许可通常允许嵌入作品，不允许以可提取的原始资产形式再分发；仍需核对具体商品和 Editorial 标记 | 对质量要求高、愿意付费时使用 |

### 第二梯队：按美术方向补充

| 平台 | 适用方向 | 注意点 |
|---|---|---|
| [Fab](https://www.fab.com/) | Epic 的综合数字资产市场，适合 game-ready 人物和动画包 | 资源经常偏 Unreal/Unity；确认是否提供 FBX/GLB 等源格式，不要只买引擎专用包 |
| [BOOTH](https://booth.pm/en/browse/3D%20Models) | VRoid/VRChat/日系角色、服装和配件丰富 | 商品条款高度个别化，语言与商业/改编/署名条件要逐项核对 |
| [BlenderKit](https://www.blenderkit.com/) | Blender 内检索模型和素材，适合管线加工 | 人物不是唯一重点；注意 Royalty Free 与 CC0 的差异 |
| [Kenney](https://kenney.nl/assets?q=3d) | 统一风格、轻量、许可友好的游戏资产 | 完整人物选择少，但许可通常比社区市场省心，适合快速原型 |

### 暂不优先

- **Ready Player Me**：过去是很好的跨平台 Avatar SDK，但本次在 2026-07-30 核对时旧官方文档入口无法访问。除非重新确认当前服务状态、SDK 可用性和长期条款，否则不应把新实现绑定到它。
- **Unity/Unreal 直接嵌入 Web**：当前只是 Landing 局部人物，生成物、加载成本和运行时复杂度都不匹配。
- **纯 iframe 嵌入 Sketchfab Viewer**：适合展示作品，不适合把 Garmin 状态精确映射到自有动画，且 UI、网络依赖与视觉控制较弱。

## 许可检查清单

每个候选模型必须单独记录：

1. 模型作者、来源 URL、下载/购买日期与许可版本。
2. 是否允许商业使用；站点即使无付费功能，也不应默认按非商业处理。
3. 是否要求署名，署名应放在哪里。
4. 是否允许修改、重新绑定骨骼、合并 Mixamo 动作、压缩纹理和转换为 GLB。
5. 是否允许把模型随前端公开部署。Web 资产理论上可被访问，许可必须允许以“作品的一部分”发布，同时应用应避免提供明显的原文件下载入口。
6. 是否含 Editorial Only、Non-Commercial、No Derivatives 或禁止生成式训练等额外限制。
7. 模型、动作和贴图可能来自不同作者，三者许可都要满足。

## 性能与体验约束

- 模型优先使用 GLB；控制三角面、骨骼数、材质数量和贴图尺寸。
- 对 260px 展示区域，先以 **单模型、单主光源、透明背景、无后处理** 为基准，不追求游戏场景效果。
- 使用 Draco 或 Meshopt 压缩前，需要把解码器成本一起计入；小模型未必值得。
- 视口外暂停渲染，页面不可见时停止动画；组件卸载时释放 geometry、material、texture 和 renderer。
- `prefers-reduced-motion` 下停在静态姿态；WebGL 不可用、加载失败或节流设备显示 poster/当前 CSS 人物。
- 不要让模型加载阻塞文章与 Landing 主要内容；延迟加载 3D 资源。

## 最小验证方案

在正式实现前做一个隔离原型，不接 API：

1. 选择一个许可清晰、低模、已绑定的人物。
2. 准备 idle、celebrate、walk/breathe、tired 四段动作并合并进一个 GLB。
3. 分别用 `<model-viewer>` 与 Three.js 渲染同一资产。
4. 比较首次加载资源体积、移动端帧率、状态切换效果、透明背景、减少动态效果和失败降级。
5. 若 `<model-viewer>` 能满足动画切换且视觉无损，选择它；若需要交叉淡化、动作局部混合或 VRM，选择 Three.js。

## 官方证据入口

- Three.js Manual: <https://threejs.org/manual/>
- Babylon.js: <https://www.babylonjs.com/>
- PlayCanvas: <https://playcanvas.com/>
- model-viewer: <https://modelviewer.dev/>
- Sketchfab downloadable models: <https://sketchfab.com/3d-models?features=downloadable>
- Adobe Mixamo FAQ: <https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html>
- VRoid Hub: <https://hub.vroid.com/en>
- CGTrader Characters: <https://www.cgtrader.com/3d-models/character>
- TurboSquid Characters: <https://www.turbosquid.com/Search/3D-Models/character>

