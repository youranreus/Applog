# Landing 个人化 VRM 人物技术设计

## Architecture

在现有 `LandingTodayStatus/TodayCharacter.vue` 的组件边界内替换人物渲染层，不改变 Garmin 状态 API、`LandingTodayStatus` 数据流或指标组件。

```text
IGarminTodayStatus.evaluation.status
                    ↓
          TodayCharacter state adapter
                    ↓
       VRM renderer + animation controller
                    ↓
        canvas / poster fallback surface
```

### Runtime

- `three`：场景、相机、灯光、WebGLRenderer、AnimationMixer。
- `@pixiv/three-vrm`：加载和标准化 VRM humanoid。
- `GLTFLoader`：加载 VRM/动作资源。
- 不引入完整游戏引擎或在线编辑器运行时。
- 是否使用 TresJS 延后到原型验证；默认直接封装 Three.js，避免单场景额外抽象。

## Asset Pipeline

1. 使用 VRoid Studio 创建个人化角色。
2. 用户提供最终 VRM，并在提交前确认服装、发型、纹理等全部资产允许网站公开展示和随构建部署；不使用示例模型代替最终资产验收。
3. 为角色准备 idle、celebrate、breathe、tired 四类动画。
4. 在离线工具链中完成动画重定向、裁剪和验证，避免浏览器承担不必要的格式转换。
5. 优化纹理、材质、骨骼和文件大小；输出模型、动画及 poster 图。

模型文件不直接从 VRoid Hub 热链，不依赖第三方 API。

## State Mapping

| Garmin 状态 | 动画语义 |
|---|---|
| 无数据 | idle |
| 状态很好 | celebrate |
| 状态不错 | upbeat idle 或轻微 walk |
| 活着 | breathe |
| 挣扎中 | tired |

状态变化通过 AnimationMixer 交叉淡化，不重新加载模型。动画不存在时回退 idle。

## Rendering Lifecycle

- 仅当人物区域接近视口时异步加载 Three.js 相关代码与 VRM 资产。
- canvas 使用透明背景，服从现有 Landing 排版，不创建独立卡片表面。
- 使用 `ResizeObserver` 同步容器尺寸和设备像素比上限。
- 页面隐藏、人物离开视口或用户启用减少动态效果时暂停渲染循环。
- 组件卸载时清理 RAF、Observer、renderer、geometry、material、texture 和 mixer 引用。

## Fallback and Accessibility

- canvas 不作为唯一语义来源；外层继续使用当前状态的可访问名称。
- 模型加载前显示 poster；失败、WebGL 不可用或资源超时继续显示 poster/现有 CSS 人物。
- `prefers-reduced-motion: reduce` 使用静态中性姿态，不播放循环动画。
- 3D 资源失败不得影响今日指标、文章和后续 Landing 内容。

## Performance Budget

原型阶段记录而不预设虚假的绝对阈值，至少比较：

- Three.js 代码分块与 VRM/动作资源的传输体积。
- 桌面及一台移动设备的首次可见时间、稳定帧率和内存趋势。
- 页面离屏/后台时 GPU 与 RAF 是否停止。

若资源或运行成本明显破坏 Landing 的安静阅读体验，优先降低纹理、材质和动画复杂度；仍不合格则保留 CSS/poster，不强行上线 3D。

## Compatibility and Rollback

- 不修改后端与共享类型，无数据迁移。
- 新渲染器保持在 `TodayCharacter.vue` 边界内，可通过还原组件或功能开关回退。
- 首次实现采用隔离原型/可替换组件，不直接删除现有 CSS 人物，直至视觉与性能验收通过。

## Risks

- VRoid 导出角色的服装、发型或纹理可能有独立授权，必须逐项留档。
- Mixamo 动画与 VRM humanoid 骨架并非天然一致，可能需要 Blender 或专用转换工具进行重定向。
- VRM 通常比当前 CSS 人物显著增加传输和 GPU 成本。
- 二次元角色如果细节过多，可能与 Landing 克制风格冲突；美术验收是上线门槛。
