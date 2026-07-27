# Landing 多邻国学习统计 — 实施计划

## 0. 开发前门禁

- [ ] 运行 `trellis-before-dev`，读取任务 PRD、设计、实施计划以及 manifests 中列出的规范。
- [ ] 确认任务状态已由用户批准后切换为 `in_progress`。
- [ ] 记录改动前 `git status`，保留无关用户改动。

## 1. 建立共享契约

- [ ] 在 `@applog/common` 增加 `IDuolingoConfig`、`IDuolingoLandingStats` 及子类型。
- [ ] 增加 `SYSTEM_DUOLINGO_CONFIG` key、JWT mask 和配置判定/脱敏/保留 helper。
- [ ] 更新 common exports；保持 `ISystemBaseConfig` 不承载 JWT。
- [ ] 用纯函数测试覆盖脱敏、空值保留、启停和 IANA 时区验证边界。

验证点：

- JWT 只存在于私有配置类型，不存在于公开 stats DTO。
- 空 JWT 和占位 JWT 均保留已存值。
- 非法时区不能进入已保存配置。

## 2. 管理配置与权限边界

- [ ] 扩展 `SystemConfigService`，增加 Duolingo 配置解析、原始读取、脱敏读取与写入。
- [ ] 通用 config 读取对新 key 执行 admin + 脱敏保护。
- [ ] 通用 config 写入拒绝新 key，强制走专用接口。
- [ ] 新建 admin DTO，使用 class-validator 校验用户名、JWT、时区和 enabled。
- [ ] 在 Duolingo controller/service 暴露 `GET/PUT /duolingo/config`。
- [ ] 配置保存时使 stats 缓存 generation 失效。

验证点：

- 非 admin 无法读取配置。
- admin 读取不到真实 JWT。
- 更新非 JWT 字段不会清除旧 JWT。

## 3. 第三方客户端和纯解析器

- [ ] 新建 `DuolingoClient`，实现 lookup、主数据和 XP summaries 三个请求。
- [ ] 统一 timeout、headers 与无敏感信息的错误分类。
- [ ] 新建纯解析/日期工具，处理字段别名、tier、课程、XP、时长和时区日期键。
- [ ] 构造固定 7 日窗口、全年日历、语言聚合与分位数输入数据。
- [ ] 为公开 lookup 空用户、401/403、超时、schema drift 编写单元测试。
- [ ] 为跨年 7 日、闰年、日期字符串、Unix 秒、时长 null、tier 越界、非语言课程编写表驱动测试。

## 4. 服务端缓存与公开 API

- [ ] 新建 `DuolingoService` 和 `DuolingoModule`，接入 AppModule 与 module barrel。
- [ ] 实现 30 分钟成功缓存、1 分钟首次失败缓存和 single-flight。
- [ ] 实现 stale-while-revalidate；旧 generation 请求不得污染新配置缓存。
- [ ] 暴露公开 `GET /duolingo/stats`，只返回稳定 DTO 或 null。
- [ ] 测试并发合并、缓存命中、首次失败、过期快照、配置更新和旧请求回写竞争。

回滚点：完成本步后后端模块可独立移除，不影响 Landing 与现有 API。

## 5. 管理端配置 UI

- [ ] 新增 frontend Duolingo admin API。
- [ ] 新建 `DuolingoSettings.vue`，封装加载、脱敏 JWT draft、保存、错误和通知逻辑。
- [ ] 在 `SystemSettings.vue` 的 admin-only 区域挂载配置组件，避免继续膨胀主 SFC。
- [ ] 表单提供启用、用户名、JWT 和 IANA 时区字段；说明 JWT 过期后的更新方式。

验证点：

- 非 admin 不发配置请求。
- 留空 JWT 保存不会清空凭证。
- 加载/保存失败保持草稿并提供重试。

## 6. Landing 数据与展示

- [ ] 新增公开 API 和 `useLandingDuolingoStats`，请求与文章、Meta 完全独立。
- [ ] 新建 Landing 视图工具：时长/XP/日期格式化、热力图周布局和强度分档。
- [ ] 新建 `LandingDuolingoStats.vue`，实现四项排版指标、前 2 语言小卡片和年度热力图。
- [ ] 在 `Landing/index.vue` 中放置于 Profile 和 Recent Posts 之间。
- [ ] 处理 null、partial null、stale、长语言名、0 XP、闰年和移动端内部横向滚动。
- [ ] 为所有热力图日期和统计状态提供可访问文本，尊重 reduced motion。
- [ ] 增加第三方非官方关联说明。

回滚点：移除组件挂载即可恢复原 Landing，公开 API 可暂时保留。

## 7. 验证与评审

自动验证：

```bash
python3 -m py_compile .trellis/scripts/common/task_context.py .trellis/scripts/task.py
pnpm --filter @applog/common run build
pnpm --filter @applog/backend run test:unit
pnpm --filter @applog/backend run build
pnpm --filter @applog/frontend run test:unit
pnpm --filter @applog/frontend run type-check
pnpm --filter @applog/frontend run build-only
git diff --check
```

文件级静态检查：

```bash
pnpm --filter @applog/backend exec eslint <本任务改动的后端 ts 文件>
pnpm --filter @applog/frontend exec eslint <本任务改动的前端 ts/vue 文件>
pnpm --filter @applog/frontend exec oxlint <本任务改动的前端 ts/vue 文件> -D correctness
```

手工与浏览器验证：

- [ ] 1440px、768px、390px 三档检查 Landing 节奏、热力图可读性和页面无横向滚动。
- [ ] 键盘导航、焦点可见、读屏名称和 reduced-motion。
- [ ] 配置缺失、停用、JWT 过期、首次失败、stale 快照、正常数据。
- [ ] 浏览器响应、构建产物和服务端日志搜索确认 JWT 未泄露。
- [ ] 连续/并发访问公开接口确认缓存和 single-flight 生效。

## 8. 收尾

- [ ] 运行 `trellis-check` 做跨层数据流、规范、lint、类型、测试和视觉复核。
- [ ] 用 `trellis-update-spec` 写入 Duolingo 跨层契约及相关 index。
- [ ] 如实现中发现 DuoDash 调研口径变化，先回写 research/design，再继续。
- [ ] 使用约定式提交信息；Trellis Python 3.11 兼容修复与产品功能分开提交。
