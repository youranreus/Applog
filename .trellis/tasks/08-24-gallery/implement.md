# 相册功能实施计划

## 0. 开发前门禁

- [ ] 使用 `trellis-before-dev` 重新加载 backend/common/frontend 规范和本任务设计。
- [ ] 确认工作树状态，保留任何与本任务无关的用户修改。
- [ ] 安装并锁定最小依赖：OSS SDK、Fastify multipart、EXIF、图像处理、MapCN Vue/MapLibre；不引入 deck.gl。
- [ ] 准备无隐私、可再分发的小型 JPEG/PNG/WebP/HEIC 测试夹具。

## 1. 共享契约

- [ ] 在 `@applog/common` 增加 gallery 类型、状态字面量、上传限制、secret mask 和纯路径/URL helper，并从根 barrel 导出。
- [ ] 为 URL 斜杠规范化、路径片段编码、folder slug、支持格式和日期游标建立确定性测试或由后端测试覆盖。
- [ ] 先构建 common，再让 backend/frontend 消费同一投影，禁止两端私自重定义公开 payload。

## 2. 配置、凭证和 OSS 适配层

- [ ] 增加 `GalleryConfigEntity`，在 `SecretEncryptionService` 注册 `gallery.oss-credential`，实现加密保存、掩码读回和 blank/mask 保留语义。
- [ ] 实现 config revision / verified revision 状态机；相关字段变化必须自动禁用并使验证失效。
- [ ] 建立 `GalleryOssAdapter` 接口与 Aliyun 实现，使 list/put/head/delete 可被单元测试替换。
- [ ] 实现确定性 probe 的连接、CDN 和权限测试；所有路径走 `finally` 清理，失败分类可读且日志无 secret。
- [ ] 增加 admin config GET/PUT/test API 和启用门禁测试。

## 3. 相册领域与公开 API

- [ ] 增加 Album/Photo entities、关系、索引、storage-state 字面量和 `ENTITY_LIST` 注册。
- [ ] 实现相册创建/更新/删除；folder 只在创建时设置，非空删除必须失败。
- [ ] 实现公开 status、album summary、升序 keyset photo page 和 photo detail；关闭开关时所有内容 API 拒绝并且无数据泄漏。
- [ ] 构建 CDN URL 时只消费数据库 object key 和服务端配置；公开 DTO 排除 source key、原始文件名、raw EXIF 和凭证。
- [ ] 覆盖相同发布时间的 ID 次序、空相册 admin/public 差异、失效游标和 disabled 状态。

## 4. 上传、EXIF 与删除恢复

- [ ] 配置 Fastify multipart；每次只接收一个文件，30 MB 硬限制，magic-byte/MIME/尺寸校验优先于扩展名。
- [ ] 实现受控临时文件生命周期和最多 20 张、前端并发 2 的批量队列契约。
- [ ] 用 `exifr` 读取 allowlist EXIF/GPS，并实现 capture-time precedence、经纬度范围及缺失值降级测试。
- [ ] 用图像处理边界生成 HEIC -> auto-oriented JPEG 展示图，并将 HEIC 源文件写到 `.originals`；其他格式避免不必要的复制。
- [ ] 增加仓库命令/文档来检查 self-hosted libvips HEIC 能力，并用 fixture 验证真实转换。
- [ ] 上传失败时补偿清理已写对象；删除采用 `deleting -> delete_failed/retry -> removed` 状态机并验证幂等。
- [ ] 覆盖格式伪装、超限、部分 OSS 失败、数据库失败补偿、重复删除和非空 album gate。

## 5. 管理端配置和导航

- [ ] 在 Dashboard 系统设置中增加独立 `GallerySettings.vue`：OSS/CDN/path 表单、masked secret、测试连接、验证状态和 gated switch。
- [ ] 保存、测试、启用使用明确的三段反馈；配置变化后 UI 立即显示“需要重新测试”。
- [ ] 加入 `/gallery`、`ROUTE_NAMES.GALLERY` 和默认导航源；`useLayoutStore` 只在 public status enabled 时解析该入口。
- [ ] disabled、status 加载失败和配置切换后导航刷新行为有测试，不能因 status 失败暴露入口。

## 6. 同页相册体验与管理员操作

- [ ] 建立 `pages/Gallery/` 的薄页面、API factories、page hooks 和 page-local components。
- [ ] 实现“相册窗口”：照片主导首屏、轻量相册 rail、稳定行序照片网格、album empty/loading/error/disabled 状态。
- [ ] 管理员在同一页面获得 album CRUD、单张 metadata edit、上传队列、删除/重试控件；游客和普通用户 DOM 中不出现写操作。
- [ ] 上传逐张显示 queued/uploading/success/failure；部分成功不会回滚成功项，失败项可重试。
- [ ] 用全屏 shadcn Dialog 实现图片预览和 metadata rail；键盘、焦点恢复、Escape、窄屏堆叠和 reduced motion 合格。
- [ ] 照片 edit 支持 title/description/publishedAt/lat/lon；不允许改 raw EXIF 或 object key。

## 7. MapCN Vue 小地图

- [ ] 按 MapCN Vue registry/base-map 方式加入仓库组件和最小 MapLibre 依赖，导入 MapLibre CSS。
- [ ] 仅在 Dialog 打开且 GPS 有效时 lazy-load 地图，以 `[longitude, latitude]` 顺序放一个 marker。
- [ ] 小地图失败时回退坐标文本；无 GPS 时完全隐藏；地图错误不传播为 Dialog 错误。
- [ ] 验证 desktop rail 和 mobile stacked layout，避免 WebGL 实例在 Dialog 关闭后泄漏。

## 8. 全量验证和规范沉淀

- [ ] 运行 backend 单测覆盖配置、权限、排序、上传、补偿和删除状态机。
- [ ] 运行 frontend 单测覆盖 URL/nav/status、page hooks 和关键交互状态。
- [ ] 运行 common build、backend lint/build/test、frontend lint/type-check/test/build。
- [ ] 在 1440px 和 390px 浏览器中检查公开浏览、管理员编辑、全屏 Dialog、地图有/无/失败、上传部分失败和 disabled 状态。
- [ ] 用 `trellis-check` 做 spec、跨层、复用、权限、secret 和数据流复核并修复所有已验证问题。
- [ ] 用 `trellis-update-spec` 写入 gallery 跨层合同并链接 backend/frontend/common index。
- [ ] 记录 HEIC self-hosted 运行要求和 OSS 最小权限文档。
- [ ] 按 Conventional Commits 生成提交信息并提交；最后使用 `trellis-finish-work` 收尾。

## 验证命令

```bash
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run lint
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run lint
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build
pnpm --filter @applog/backend run gallery:doctor
```

## 风险文件与回滚点

- `packages/backend/src/module/secret-encryption/*`：purpose 字符串是持久化协议；已有 purpose 和 envelope 版本不得改名。
- `packages/backend/src/entities/index.ts` / `app.module.ts`：漏注册会造成运行时缺表或模块不可用。
- `packages/frontend/src/stores/useLayoutStore/index.ts`：status 失败必须 fail closed，不能破坏既有页面导航。
- multipart/global Fastify 配置：限制只应用于 gallery upload，不能意外改变其他 API body 行为。
- MapLibre CSS/WebGL：需要验证只影响 Gallery Dialog 且关闭后释放。
- 回滚优先级：关闭 gallery -> 保留数据库与 OSS；如上传管线异常，禁用 admin upload 而不影响公开 ready 数据；绝不在回滚中批量删除对象。
