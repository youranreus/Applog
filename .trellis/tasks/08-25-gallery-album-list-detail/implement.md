# 实施计划

## 1. 固化路由与状态边界

- [x] 新增 `GALLERY_ALBUM` 路由名和 `/gallery/:albumId` 路由，并接入 Header 返回行为。
- [x] 重构 `useGallery.ts`，让相册摘要加载与单相册照片加载分离，移除列表页的逐相册预取。
- [x] 为详情页补齐目标相册解析、无效 ID、独立重试及局部刷新语义。

验证点：`/gallery` 网络行为中没有相册照片请求；`/gallery/:albumId` 只请求一个相册的照片。

## 2. 重建相册列表页

- [x] 将 `Gallery/index.vue` 收敛为图库状态、相册封面网格和管理员相册 CRUD。
- [x] 实现 8px 圆角封面、固定比例、底部可读性渐变、左下角标题与日期、键盘可达及焦点样式。
- [x] 实现管理员空相册占位、空列表、关闭、加载与错误状态。

回滚点：列表页模板与样式可独立恢复，不影响接口与详情路由。

## 3. 新建相册详情页

- [x] 创建 `AlbumDetail.vue`，展示相册摘要、返回入口及只属于该相册的内容状态。
- [x] 搬迁并调整现有瀑布流，去掉 `80rem` 上限，保留外部 gutter、列 gap、3/2/1 列分配和加载更多。
- [x] 将上传入口与队列放到详情页，上传/重试后只刷新当前相册相关数据。
- [x] 提取并接入照片预览组件，保留 EXIF、GPS 地图、管理员编辑/删除和全屏 Teleport 样式。

回滚点：详情页和局部预览组件为新增边界；若拆分产生回归，可恢复原预览模板而不改变数据契约。

## 4. 更新可执行契约与测试

- [x] 更新 `gallery-contract.spec.mjs`，断言新路由、列表无照片预取、管理员操作分工、详情全宽瀑布流与现有预览契约。
- [x] 更新 `.trellis/spec/common/shared/gallery-contracts.md` 的两层页面契约与浏览器验收项。
- [x] 保留上传并发、访客/管理员 DOM 边界、地图降级和全屏预览断言。

## 5. 质量与视觉验证

- [x] `pnpm --filter @applog/frontend run test:unit`
- [x] `pnpm --filter @applog/frontend run lint`
- [x] `pnpm --filter @applog/frontend run type-check`
- [x] `pnpm --filter @applog/frontend run build`
- [x] `git diff --check`
- [x] 在 1440px 与 390px 检查相册网格、详情瀑布流、边距、无横向溢出、焦点/返回行为和全屏照片预览。
- [x] 最终检查不包含后端、存储或数据模型的意外改动。
