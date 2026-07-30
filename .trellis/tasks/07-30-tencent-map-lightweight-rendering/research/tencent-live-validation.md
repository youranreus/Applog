# 腾讯静态地图真实验证

验证日期：2026-07-30。所有请求均使用香港维多利亚公园这一公开地点与人工合成路线，没有使用私人 Garmin 活动、活动 ID 或完整真实轨迹。

## Outcome

腾讯方案通过技术原型门禁，建议作为中国大陆 Garmin 封面的首选底图 provider，但在默认生产切换前仍需由账户所有者确认当前服务条款允许将生成的静态图持久化为活动封面。

## Runtime result

- `GARMIN_MAP_PROVIDER=tencent` 能由 worker 环境正常加载。
- 真实静态图请求返回有效 960×960 raster，并由现有 Pillow 合成链路生成 480×480 WebP。
- 最终 provider 为 `tencent-route`，outcome 为 `map_success`。
- 请求只包含转换后 center、zoom、size、scale、maptype 与 Key；生产实现不包含 path、marker、活动 ID 或完整轨迹。
- 当前 Key 的实际响应额度：QPS `5`，每日 `5000` 次。本项目只在异步生成/刷新持久化封面时调用，不随页面浏览实时调用，该额度足够当前规模。

## Zoom correction found by the visual gate

第一次固定 zoom 样图暴露出路线约放大两倍：腾讯静态图使用 256px tile pyramid，而项目 `MapCamera` 遵循 MapLibre 的 512px tile pyramid。两者相同数字的 zoom 并不等价。

最终映射固定为：

```text
tencent_api_zoom = floor(map_camera_zoom) + 1
overlay_camera_zoom = tencent_api_zoom - 1
```

API zoom 被限制在 4–17。修正已写入产品代码、单测、技术设计和 Garmin code-spec。

## Quantitative alignment gate

测试专门请求了带腾讯 server-side `path` 的公开参考图，并将它与同一 clean basemap 上由 AppLog 本地绘制的路线进行像素比较。`path` 只用于公开测试门禁，生产请求仍不发送路线。

| Tencent API zoom | 2px 容差内重合率 | 最终图最大边界偏差 | Result |
|---|---:|---:|---|
| 12 | 100% | 1.5px | Pass |
| 15 | 100% | 1.5px | Pass |
| 17 | 100% | 1.5px | Pass |

门槛为重合率至少 95%、最大边界偏差不超过最终图 2px，三档全部通过。原始机器报告见 `visual/tencent-alignment-report.json`。

## Visual assessment

腾讯 roadmap 的中文标签、道路等级、地铁、场地和 POI 密度明显高于此前暗色 CARTO 原型，也比当前低饱和 Protomaps fixture 更容易识别城市语境。最终样式使用约 6px 红色粗线、首尾方向箭头和 16px 目标边距。

可查看：

- `visual/tencent-public-route.webp`：最终 fit 后公开合成路线封面。
- `visual/tencent-alignment-server-path-z15.webp`：腾讯参考路线。
- `visual/tencent-alignment-local-path-z15.webp`：AppLog 本地路线。
- `visual/tencent-victoria-api-zoom-12.webp`、`15.webp`、`17.webp`：固定 zoom 底图控制样图。

当前机器没有 Docker，也没有正在运行的 Protomaps renderer，因此无法在完全相同 camera 上重新生成一张 Protomaps 对照图；判断同时参考了之前保留在 `/private/tmp` 的 CARTO/Protomaps 原型。这个限制不影响像素对齐结论，但“同 camera Protomaps A/B”仍属于未完成的可选比较。

## Remaining release gate

官方静态图文档明确建议对相同请求缓存结果以减少在线调用，但没有在公开接口页给出足够明确的长期持久化/再展示授权文字。因此上线前需在当前腾讯位置服务账户协议或工单中确认：允许将静态图作为 AppLog 活动封面的组成部分持久保存并向站点访客展示。确认前保留 Protomaps 回滚链路，不批量删除旧资产。
