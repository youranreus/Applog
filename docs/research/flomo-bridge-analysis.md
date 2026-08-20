# `giraffe-tree/flomo-bridge` 源码审计：它是怎么处理 flomo 数据的

> 审计日期：2026-08-20  
> 审计版本：commit [`8ea5cb8`](https://github.com/giraffe-tree/flomo-bridge/tree/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8)（仓库该提交时间 2026-04-25）  
> 结论只针对上述固定提交，避免 `main` 后续变化导致行号和行为漂移。

## 一句话结论

它的核心不是 flomo 官方公开读 API，也不是按标签查询，而是：

```text
用户从 flomo Web 请求中复制 Bearer Token
  → 插件复刻网页版的固定参数和 MD5 签名
  → GET /api/v1/memo/updated/ 分页拉取全部新增/修改/删除记录
  → 从响应的 tags 数组生成 YAML frontmatter
  → HTML 正文转 Markdown、附件下载到 vault
  → 按 slug 查找本地文件并覆盖/删除
```

它对 Applog 最有价值的是揭示了私有接口的数据模型、复合游标、一天回看窗口和幂等落盘思路；最不应该直接照搬的是硬编码签名密钥、伪装浏览器 headers、从登录会话复制全权 Token，以及 Obsidian 专用文件 API。

## 1. Token 获取与存储

### 获取

插件没有 OAuth、登录窗或权限范围选择。设置页指导用户：登录 `v.flomoapp.com/mine`，打开 DevTools → Network，找到 API 请求，再复制 `Authorization` 中的 Token。[`src/settings.ts` L337-L382](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/settings.ts#L337-L382)

输入时会裁掉可选的 `Bearer ` 前缀，并在 Token 变化时清除“已验证”状态；随后立即调用插件的 `saveSettings()`。[`src/settings.ts` L337-L359](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/settings.ts#L337-L359) 客户端构造函数再次执行相同的前缀归一化。[`src/flomoClient.ts` L184-L195](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L184-L195)

### 存储

`FlomoSyncSettings` 把 `token` 与目录、游标、同步统计放在同一个设置对象中，[`src/settings.ts` L15-L60](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/settings.ts#L15-L60)；主插件用 Obsidian `loadData()` / `saveData()` 原样加载和保存整个对象。[`main.ts` L67-L73](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L67-L73) 对 Obsidian 插件而言，这通常意味着 Token 明文存在 vault 的 `.obsidian/plugins/flomo-bridge/data.json`，没有系统钥匙串、加密或只读 scope。

**Applog 判断：**不要借鉴 Token 获取/存储方式。服务端应优先使用官方 MCP Token/OAuth；若为了 PoC 调私有接口，也只能把 Token 放到部署平台 secret store，禁止写入 Git、构建产物、客户端 bundle 或普通配置 JSON。

## 2. Endpoint、签名与 Headers

### 私有 endpoint

客户端硬编码：

- Base URL：`https://flomoapp.com/api/v1`；
- 每页上限：`200`；
- 更新列表：`GET /memo/updated/`。

见 [`src/flomoClient.ts` L10-L13](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L10-L13) 和 [`src/flomoClient.ts` L229-L262](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L229-L262)。这是从 Web 客户端行为逆向得到的接口，不在 flomo 公开开发者读 API 文档中。

### 请求参数

业务参数是 `limit`、`latest_updated_at`、`latest_slug`、固定时区 `tz=8:0`；首次全量请求会把更新时间和 slug 留空。公共参数每次补入 Unix 秒级 `timestamp`、`api_key=flomo_web`、`app_version=4.0`、`platform=web`、`webp=1`。[`src/flomoClient.ts` L197-L211](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L197-L211)、[`src/flomoClient.ts` L236-L255](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L236-L255)

### 签名

源码将逆向得到的 secret `dbbc3dd73364b4084c3a69346e0ce2b2` 直接写在前端代码中。签名过程是：参数 key 字典序排序；跳过空字符串；数组值排序并展开成 `key[]=value`；用 `&` 连接；尾部拼 secret；计算小写 MD5。[`src/flomoClient.ts` L10-L12](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L10-L12)、[`src/flomoClient.ts` L27-L57](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L27-L57)

插件为了浏览器运行环境内置了完整的 RFC 1321 风格 MD5 实现，而没有 Node `crypto` 依赖。[`src/flomoClient.ts` L59-L182](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L59-L182)

### Headers

请求携带 `Authorization: Bearer <token>`，并硬编码 flomo Web 的 `origin`、`referer`、固定 UUID `device-id`、`device-model=Chrome`、`platform=Web` 和 Chrome 124 User-Agent。[`src/flomoClient.ts` L214-L227](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L214-L227)

**Applog 判断：**参数构造、签名单元测试和 adapter 隔离方式可作为短期实验参考；这些常量本身不能视为稳定协议。固定 secret、版本、device-id 或签名规则任何一个变化都会使同步失效，且伪装 Web 客户端可能触发风控。生产首选仍应是官方 MCP。

## 3. 分页与增量同步算法

### 页内游标

`iterMemos(afterTs)` 从更新时间和空 slug 开始，每次调用 `fetchMemosPage()`；收到 200 条时，取最后一条 memo 的 `updated_at + slug` 作为下一页复合游标；不足 200 条或空数组则停止；页间固定等待 300ms。[`src/flomoClient.ts` L298-L348](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L298-L348)

`latest_slug` 的作用应是处理多条 memo 具有同一 `updated_at` 时的稳定翻页，避免只按秒级时间戳遗漏/重复。

### 跨轮增量

设置中持久化 `{ latest_updated_at, latest_slug }`。[`src/settings.ts` L22-L26](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/settings.ts#L22-L26) 增量同步开始时复制旧游标，并把 `latest_updated_at` 向前减一天作为容错回看窗口；原时间记为 B 点，回退后时间为 A 点。[`src/syncEngine.ts` L136-L153](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L136-L153)

同步中逐 memo 做幂等比较：A–B 回看区中内容相同的记录不计统计，但若发现本地缺失/内容变化仍会创建或更新；B–C 则作为真正的新变化统计。[`src/syncEngine.ts` L178-L231](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L178-L231)

每页处理完用该页最后一条记录更新内存设置游标，[`src/syncEngine.ts` L253-L261](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L253-L261)；但实际 `saveSettings()` 只在整轮 `engine.sync()` 成功返回后调用。[`main.ts` L187-L207](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L187-L207) 因此注释所说“实时保存”并不准确：进程中途退出会从旧持久化游标重跑，依靠内容比较保证幂等。

### 一个明确的实现缺口

虽然设置保存了 `latest_slug`，`SyncEngine` 调用 `iterMemos()` 时只传入 `cursor.latest_updated_at`，[`src/syncEngine.ts` L155-L168](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L155-L168)；而 `iterMemos()` 内部总把初始 `latestSlug` 设为空字符串。[`src/flomoClient.ts` L305-L315](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L305-L315) 所以跨轮保存的 slug 实际没有参与首个请求。一天回看窗口大幅缓解了漏数风险，但保存该字段并没有实现预期的精确续传。

**Applog 可借鉴：**复合游标、向前回看窗口、按稳定 ID 幂等 upsert、整轮成功后原子提交游标。实现时应真正传递 `{updatedAt, slug}`，将 checkpoint 与生成物原子写入，并对乱序、同秒多条、空页、重复页做测试。

## 4. Tag 解析与 Markdown frontmatter

接口响应类型直接把 `tags` 定义为字符串数组，例如 `['英语/如何学习']`。[`src/types.ts` L13-L30](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/types.ts#L13-L30) 插件**没有向 flomo 传标签过滤条件**，而是拉取所有变化后使用响应中的 `memo.tags`。

`memoToMarkdown()` 将 tags 通过 `JSON.stringify()` 输出成 YAML flow sequence，并写入 `slug`、创建/更新时间、tags 和 source；正文则交给 `htmlToMarkdown()`。[`src/formatter.ts` L149-L198](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/formatter.ts#L149-L198)

文件名由创建日期、第一个标签的叶子、正文前 6 个字符和 slug 组成；标签只用于命名展示，不决定是否同步。[`src/formatter.ts` L200-L245](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/formatter.ts#L200-L245)

正文转换是一组正则替换：代码、强调、链接、图片、标题、列表、段落等，再剥除其他标签并解码少量实体。[`src/formatter.ts` L15-L99](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/formatter.ts#L15-L99) 这不是完整 HTML parser：嵌套列表、属性顺序、复杂实体、恶意 URL 和格式边界都可能处理不正确。

**Applog 可借鉴：**以 API 返回的结构化 `tags` 做精确白名单，不要从正文正则猜标签；保存 slug、created_at、updated_at 作为稳定元数据。不要照搬正则 HTML 转 Markdown；服务端应使用成熟 HTML parser/sanitizer，并在渲染前再次做 XSS 清洗。

## 5. 附件下载

接口只为附件定义 `name` 和 `url`。[`src/types.ts` L7-L11](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/types.ts#L7-L11) 单条 memo 处理时，插件按每批最多 3 个并发下载文件，并建立远程 URL → 本地路径映射。[`src/syncEngine.ts` L367-L384](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L367-L384)

底层下载用 Obsidian `requestUrl()`，只加 flomo referer；非 200 或任何异常都吞掉并返回 `null`，没有鉴权 header、超时、重试或大小限制。[`src/flomoClient.ts` L351-L375](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L351-L375)

只接受代码识别出的图片/音频扩展名；优先用 URL 最后一段作为稳定本地文件名，失败时退回 `memo.slug + 更新时间`，按 memo 创建日期保存到 `attachments/YYYY/MM/DD/`；存在同路径则跳过，不校验内容哈希。[`src/syncEngine.ts` L497-L567](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L497-L567) Markdown 中若本地下载失败，会回退到远程 URL。[`src/formatter.ts` L117-L147](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/formatter.ts#L117-L147)

**Applog 可借鉴：**受控并发、附件本地化、日期分层目录。需要补上超时、指数退避、响应大小和 MIME 校验、内容哈希、失败队列、远程 URL 过期处理，以及发布前版权/隐私审核。

## 6. 更新、删除与冲突策略

### 更新

插件用文件名末尾 `_{slug}.md` 搜索本地文件。[`src/syncEngine.ts` L435-L455](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L435-L455) 找到后将整个文件内容和新生成内容做字符串相等比较：完全相同则跳过；不同则覆盖。如果标签/标题变化导致文件名变化，它先把旧文件移到垃圾箱，再新建文件。[`src/syncEngine.ts` L400-L432](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L400-L432)

这意味着 flomo 是唯一真源：用户在同步生成的 Markdown 中加入的任何本地编辑，下一次远端 memo 被处理时都可能被覆盖；没有三方 merge、冲突标记或“保护本地字段”。

### 删除

增量响应中 `deleted_at` 非空时，插件把对应本地 Markdown 移到垃圾箱并递归删除文件名包含 slug 的附件。[`src/syncEngine.ts` L353-L365](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L353-L365)、[`src/syncEngine.ts` L457-L488](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L457-L488)

另有显式 cleanup：全量拉取远端所有 slug 和 deleted slug，扫描目标目录，删除“远端不存在或已标记删除”的本地文件。[`src/syncEngine.ts` L595-L668](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L595-L668) 该清理没有确认框；主插件注释说明确认被移除。[`main.ts` L350-L389](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L350-L389)

**Applog 可借鉴：**将同步目录明确标记为 generated、slug 作为主键、内容相同不写、删除使用 tombstone。博客侧更安全的做法是生成临时目录并原子替换，删除先进入 quarantine/审计日志；绝不能让同步器扫描或删除用户手写内容目录。

## 7. 调度触发

插件加载时读取设置、注册命令并启动自动同步。[`main.ts` L23-L52](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L23-L52) 触发方式包括：

- 命令面板的增量、全量、设置和修复/清理命令；[`main.ts` L75-L112](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L75-L112)
- `window.setInterval` 定时调用增量同步；间隔单位实际是秒；[`main.ts` L114-L132](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L114-L132)
- 设置页可选手动、10/30 秒、1/5/10/30 分钟、1 小时。[`src/settings.ts` L469-L490](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/settings.ts#L469-L490)

`isSyncing` 是进程内互斥标志，避免同一个插件实例重叠执行。[`main.ts` L137-L150](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L137-L150) 它不是跨进程锁，也没有持久化 lease。

**Applog 判断：**浏览器 `setInterval` 和 UI 命令只适用于 Obsidian/Electron。服务端应使用部署平台 cron/GitHub Actions，并加跨实例互斥、最长运行时间、结构化日志和失败告警。同步内容没必要 10 秒更新；小时级或部署时同步更稳妥。

## 8. 错误与限流处理

HTTP 非 200 被包装成 `FlomoApiError`；JSON `code !== 0` 时对签名错误、登录/auth 字样做少量映射，其余直接抛出；网络错误也只改写消息。[`src/flomoClient.ts` L257-L295](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/flomoClient.ts#L257-L295)

主插件能针对 401/`code=-1` 提示 Token 无效，针对 429 提示“稍后再试”。[`main.ts` L442-L461](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/main.ts#L442-L461) 但没有读取 `Retry-After`、指数退避、带抖动重试、熔断或自动降低同步频率。页间 300ms 只是固定“礼貌性限速”。

单条 memo 处理异常会被捕获并继续下一条；B–C 区失败会计数，A–B 回看区失败甚至不进入失败统计。[`src/syncEngine.ts` L212-L231](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/syncEngine.ts#L212-L231) 由于整轮仍可能成功并前移游标，失败项只能依赖下一次“一天回看”再次遇到；若持续失败超过回看窗口，可能失去自动重试机会。

**Applog 可借鉴：**API 错误归一化、逐条隔离失败。必须补上 429/5xx 重试与预算、失败 ID 持久队列、失败时不越过未处理记录或至少按 ID 补偿、指标和报警。

## 9. Obsidian/Electron 专属部分

manifest 明确 `isDesktopOnly: true`。[`manifest.json` L1-L10](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/manifest.json#L1-L10) 以下逻辑不能直接搬到 Applog 服务端：

- `obsidian.requestUrl` 的跨域请求与附件下载；
- `App`、`TFile`、`TFolder`、Vault adapter、metadata cache；
- `fileManager.trashFile` 和 Obsidian 垃圾箱语义；
- `window.setInterval`、Notice、状态栏、设置面板；
- `[[wikilink]]` 反向链接索引和重写。

反向链接模块通过扫描 vault 建立 slug → 文件路径索引，再把 flomo memo URL 改成 Wikilink/Markdown 链接。[`src/backlinkIndex.ts` L19-L69](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/backlinkIndex.ts#L19-L69)、[`src/backlinkRewriter.ts` L12-L68](https://github.com/giraffe-tree/flomo-bridge/blob/8ea5cb86f0b955309ef9b19f722119cfd2b9a8c8/src/backlinkRewriter.ts#L12-L68) Applog 若要保留引用关系，应在自己的内容模型中解析 memo ID，再生成站内 URL，不需要 Obsidian 索引。

## 10. 给 Applog 的可复用设计与风险清单

### 可直接借鉴的设计思想

1. `FlomoSourceAdapter` 隔离外部协议，业务层只接收规范化 memo。
2. 以 slug 为稳定主键，保留 `created_at`、`updated_at`、结构化 tags。
3. 复合游标 `{updatedAt, slug}` + 有界回看窗口 + 幂等 upsert。
4. 只发布指定标签白名单，其他 memo 不落入博客生成物。
5. 附件受控并发下载并改写为站内资源。
6. 内容生成在临时目录完成，验证成功后原子替换；最后再提交 checkpoint。
7. tombstone 驱动删除，并保留审计/恢复能力。

### 不应照搬

1. Web 会话 Bearer Token 明文落盘。
2. 硬编码逆向 secret、device-id、User-Agent 和私有 endpoint。
3. 拉取全部个人 memo 后才过滤标签；最小权限原则下应优先让官方 MCP 按标签查。
4. 正则 HTML → Markdown、未经完整 sanitizer 的内容渲染。
5. 远程删除直接驱动本地清理，且扫描范围靠路径字符串判断。
6. 固定 300ms 代替真正的限流/退避策略。
7. 单条失败后仍推进全局游标而没有持久补偿队列。

### 维护与安全风险评级

| 风险 | 等级 | 原因 |
| --- | --- | --- |
| 私有 API/签名变化 | 高 | flomo 未公开承诺 endpoint、secret、参数和响应稳定性 |
| Token 泄漏 | 高 | Token 来自完整 Web 会话、明文保存、没有只读 scope |
| 账号风控/条款边界 | 中高 | 模拟网页版 headers 和签名，非官方集成方式 |
| 漏同步/重复同步 | 中 | 一天回看降低风险，但跨轮 `latest_slug` 未使用、失败补偿不完整 |
| 内容安全 | 中 | 正则 HTML 转换不足以作为公开博客 sanitizer |
| 误删除 | 中高 | 远端缺失可触发本地删除，且无显式确认/隔离区 |
| 附件可靠性 | 中 | 无超时、重试、大小/MIME/hash 校验，失败回退可能留下过期 URL |

## 最终建议

如果目标是实现 Applog 的 flomo 标签展示，不建议 fork 该插件或直接复制私有客户端。更稳妥的路径是：

1. 用官方 MCP `memo_search` 按发布标签读取；
2. 借鉴本项目的规范化数据模型、复合游标、回看窗口、slug 幂等和附件本地化；
3. 用服务端 secret store、成熟 sanitizer、持久失败队列、原子生成物和删除隔离区补齐生产能力；
4. 仅当官方 MCP 无法满足无人值守构建时，把 `flomoClient.ts` 的私有接口实现封装为可随时替换的实验 adapter，并设置失败时继续使用上次成功快照。

这样可以利用它已经验证过的同步经验，同时不把博客长期绑定在 flomo Web 内部实现上。
