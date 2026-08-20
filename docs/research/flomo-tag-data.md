# 博客按指定标签展示 flomo 数据：能力调研

> 调研日期：2026-08-20

## 结论

**能按标签直接读取，但目前唯一有官方文档明确支持的机器读取入口是 flomo MCP，而不是传统 REST API。** flomo 官方 MCP 提供 `memo_search`，明确支持按“关键词、标签、时间范围”检索历史笔记；该能力属于 **MAX 会员**。flomo 公开的“开发者 API”则被官方定义为“记录 API”，即写入 memo，并没有公开文档承诺读取、列表或按标签查询。

对于博客，推荐采用：**在构建/定时同步阶段由可信服务端调用官方 MCP → 按白名单标签筛选 → 清洗并生成站内 JSON/Markdown → 博客只读取生成物**。不要让浏览器直接携带 flomo Token，也不要把 flomo 登录 Cookie 或逆向接口部署到生产环境。

## 能力对比

| 能力 | 按标签读取 | 自动化程度 | 鉴权/门槛 | 适合博客生产集成 |
| --- | --- | --- | --- | --- |
| 官方 MCP | **支持**，`memo_search` 可按标签和时间范围检索 | 高 | MAX；OAuth 自动授权或 flomo Token | **推荐，但应放在服务端/构建阶段** |
| 官方开发者 API / Incoming Webhook | **不支持读取**；官方仅称其为“记录 API” | 高（仅写入） | PRO；个人 Incoming Webhook URL/密钥 | 不适合拉取展示 |
| 条件导出 | **支持**；点击标签或搜索后可导出该条件全部内容 | 低，官方流程是人工导出 HTML | 登录账号；官方文档未标为 PRO 专属 | 适合低频、人工发布 |
| flomo 应用内搜索 | 支持按包含/不包含标签筛选 | 低，仅产品 UI | 登录账号 | 可验证筛选结果，不是集成接口 |
| RSS / 标签 Feed | **未找到官方提供或文档** | — | — | 不可作为现有能力依赖 |
| 单条 memo 分享 | 官方产品有分享图/分享能力，但未发现“按标签持续发布”的官方 Feed | 低 | 单条操作 | 仅适合手工精选，不适合标签同步 |
| 私有 Web 接口 / Cookie 抓取 | Web 客户端内部可能存在，但**不属于公开官方 API** | 高 | 登录 Cookie、内部参数 | 不推荐；变更、安全与合规风险高 |

## 1. 是否能按标签直接拉取

### 1.1 官方 MCP：可以

flomo 官方帮助页列出的 MCP 工具包括：

- `memo_search`：按关键词、标签、时间范围检索历史笔记，并支持语义搜索；
- `memo_batch_get`：批量取得多条笔记完整内容；
- `tag_tree`：取得完整标签层级；
- `tag_search`：按关键词定位标签。

官方还明确给出“标签 + 时间”的示例，例如查询某标签下去年的笔记。因此，从产品能力上看，博客同步程序可先用 `tag_search`/`tag_tree` 解析标签，再用 `memo_search` 限定标签，必要时用 `memo_batch_get` 补齐正文。来源：[flomo 官方 MCP 帮助](https://help.flomoapp.com/advance/mcp)。

需要注意，MCP 是面向兼容 MCP 的客户端/Agent 暴露的协议入口，不等同于 flomo 发布了一套面向任意 Web 后端的 REST API。官方页面目前没有公开固定 HTTP endpoint、请求/响应 JSON schema、分页上限、速率限制或稳定性版本承诺；工程实现前应在自己的 MAX 账号中连接 MCP，读取实时 tool schema 并做一次带目标标签的验证。

### 1.2 官方开发者 API：不能用于读取

flomo 的 API & URL Scheme 页面只写明提供“记录 API”，入口指向账户内的 Incoming Webhook 配置；官方 FAQ 也将其描述为开发者通过 API “写入”。官方公开文档没有列出读取 memo、列出 memo 或按标签查询的开发者 REST API。因此不能把 Incoming Webhook 当成读 API。来源：[flomo 官方 API & URL Scheme](https://help.flomoapp.com/advance/api.html)、[flomo 官方 FAQ](https://help.flomoapp.com/faq.html)。

标签可以直接写入 memo 正文（如 `#博客`、`#博客/随笔`），所以写入 API 能给新 memo 加标签，但这不解决从 flomo 拉取历史 memo 的问题。标签格式与多级标签规则见：[flomo 官方多级标签说明](https://help.flomoapp.com/basic/tag.html)。

### 1.3 条件导出：可以按标签取得数据，但不是在线接口

flomo 官方支持在点击标签或搜索任意关键词后，导出该条件下的全部内容，格式为 HTML。这是一个可靠的官方数据出口，可以实现“按标签取数”，但文档描述的是页面内整理并下载的人工流程，没有提供定时任务、Webhook 或导出 API。来源：[flomo 官方存储与导出说明](https://help.flomoapp.com/basic/storage.html)。

它适合每周/月手动更新博客，或者在正式接 MCP 前做一次性迁移；不适合要求分钟级自动更新的展示。

### 1.4 RSS、分享页和私有接口

- **RSS：**截至本次调研，flomo 官方帮助中心未提供 RSS/Atom 或“标签 Feed”的使用说明，不能将其视为官方现成能力。
- **分享：**官方更新记录证明存在单条笔记分享图等分享能力，但没有发现可将某个标签持续公开为结构化 Feed 的官方说明。[flomo 官方版本更新](https://help.flomoapp.com/about-us/update.html)。
- **私有接口：**登录后的 Web/App 必然需要同步数据，但观察或复用这些内部请求属于逆向私有接口。它们没有公开稳定性承诺，可能随版本改变，也可能触发风控；Cookie 往往代表完整账号权限，泄漏后果远大于只读发布 Token。除短期个人实验外，不建议采用。

## 2. 鉴权和调用限制

### MCP

- 会员要求：官方将 MCP 列为 **MAX 权益**；PRO 不含 MCP。[flomo 官方会员介绍](https://help.flomoapp.com/membership/pro.html)。
- 鉴权：官方支持两类方式：兼容客户端首次使用时通过 flomo 登录页面完成自动授权；或在 flomo 创建 Token，粘贴到不支持自动授权的客户端。来源：[flomo 官方 MCP 帮助](https://help.flomoapp.com/advance/mcp)。
- 调用原则：官方称 AI 不会主动读取笔记，只有用户明确要求搜索/查看时才访问，并且每次操作需要确认。这个交互原则是为 Agent 客户端描述的；无人值守 CI/定时任务能否免交互长期调用，应以实际授权流程和实时 tool schema 为准。
- 限制：官方公开帮助页**没有公布** `memo_search` 的单次返回数、分页机制、QPS/日配额、Token 有效期和撤销后的错误语义。不能假设“无限调用”。同步器应低频运行、缓存结果、增量拉取，并对 401/403/429、分页遗漏和返回 schema 变化做好保护。

### 开发者写入 API

- 会员要求：开发者 API 属于 PRO 与 MAX 权益。[flomo 官方会员介绍](https://help.flomoapp.com/membership/pro.html)。
- 鉴权：用户在账户内取得个人 Incoming Webhook/API 地址；该 URL 本身应视为秘密，不能出现在前端代码或公开仓库。
- 调用限制：官方 FAQ 当前说明开发者通过 API 写入时“每天限 100 条”。但它只约束写入，和按标签读取无关。[flomo 官方 FAQ](https://help.flomoapp.com/faq.html)。

### 条件导出

官方导出说明没有列出会员门槛或调用配额，但要求在登录后的产品页面发起，并在当前页面等待生成和下载。它不是适合后端定时调用的认证协议。

## 3. 博客集成方案与风险

### 方案 A：官方 MCP 定时同步（推荐）

建议数据流：

```text
flomo（私有笔记）
  → 服务端/本机构建机上的 MCP 客户端
  → 精确匹配发布标签（例如 #publish/blog）
  → 内容清洗、字段归一、去重
  → 生成博客仓库内 JSON/Markdown
  → 静态站点构建与部署
```

实现时应做到：

1. 使用专用发布标签，例如 `#publish/blog`，不要把宽泛的个人标签直接公开；
2. Token 只放在服务端 secret store 或本机密钥环境中，绝不进入浏览器 bundle、日志或 Git；
3. 同步时按精确标签过滤，默认拒绝发布未知标签；多级标签是否包含子孙标签，应先用测试 memo 验证 MCP 的实际匹配语义；
4. 只将需要展示的字段写入生成物，移除 flomo 内部 ID、引用关系、附件私有 URL等不必要数据；
5. 对 HTML/富文本进行清洗，避免 XSS；下载图片时确认 URL 生命周期和转载权限；
6. 缓存最后成功结果。MCP 故障或会员到期时继续展示旧数据，而不是让博客请求失败；
7. 低频同步（例如每小时或每次部署），不要让每次访客请求实时穿透到 flomo。

主要风险是 MCP 的公开工程文档仍不完整，后台自动化授权、分页和速率限制需要实测；它又属于 MAX 会员能力，会员状态会影响同步。应把 MCP 封装在一个小型 adapter 后面，让数据源未来可替换。

### 方案 B：按标签导出 HTML，再转换为站内内容（稳健备选）

在 flomo 里打开目标标签，执行条件导出，将 HTML 交给博客侧转换脚本生成 JSON/Markdown。优点是完全使用官方导出、无长期密钥、数据可审阅后发布；缺点是需要手工操作，导出 HTML 结构若变化，解析器也要调整。

适合更新频率低、内容发布前必须人工审核的个人博客。即使未来使用 MCP，也建议保留导出文件作为迁移和灾备路径。

### 方案 C：写入时双写博客内容库

如果真正需求是“今后发布的新 memo 自动出现在博客”，可改变数据流：在自己的录入工具中同时写入 flomo Incoming Webhook 和博客 CMS/仓库，而不是之后从 flomo 反向读取。优点是无需 MCP 读权限、数据格式完全可控；缺点是 flomo 内后续编辑、删除或改标签不会自动同步，历史 memo 也需单独迁移。

这是没有 MAX 会员、且能控制录入入口时的自动化替代方案。

### 方案 D：逆向 Web 私有接口（不推荐）

通过登录 Cookie 调用 Web 客户端内部接口，理论上可能做到列表和标签筛选，但风险包括：

- endpoint、参数、签名和返回结构随时变化；
- Cookie/会话泄漏可能暴露整个笔记库或可写权限；
- 无官方速率和兼容性承诺，可能触发验证码或风控；
- 运维成本高，且使用边界需自行核对服务协议。

不应作为博客生产依赖，也不应为了省 MAX 会员费用而选择该方案。

## 4. 推荐决策

### 首选

若已有或愿意使用 MAX：采用 **官方 MCP + 构建时/定时服务端同步 + 静态生成物**。它是目前官方明确支持按标签读取历史 memo 的唯一机器接口。先做一个小型验证：

1. 创建 3 条测试 memo：目标标签、目标子标签、相似但不同标签；
2. 连接官方 MCP，检查 `memo_search` 的实时 schema；
3. 验证标签精确/层级匹配、排序、分页、正文和图片字段；
4. 验证 Token 重启后是否可无人值守复用；
5. 再决定定时同步频率和生成物 schema。

### 备选

- 不使用 MAX、更新不频繁：选择**按标签条件导出 HTML + 人工审核发布**。
- 不使用 MAX、但新内容必须自动发布：让自有录入入口**双写 flomo 与博客内容库**，并接受 flomo 后续修改不同步。

### 明确不推荐

不要把 flomo Token/Cookie 放到前端，也不要让博客页面在访客请求期间实时查询 flomo；不要把私有 Web 接口、非官方 RSS 转换服务或第三方代理作为唯一数据源。

## 5. 第三方取数生态核查

本节专门区分“能从 flomo 读出”和“只能向 flomo 写入”。维护状态按 2026-08-20 可见的仓库/目录页面判断；第三方项目即使近期更新，也不代表 flomo 对其私有接口作了兼容承诺。

### 5.1 可真正读出的开源实现

| 项目 | 读取 / 按标签 | 鉴权 | 部署形态 | 维护信号 | 判断 |
| --- | --- | --- | --- | --- | --- |
| [OpenCLI flomo adapter](https://github.com/partme-ai/opencli/blob/main/docs/adapters/browser/flomo.md) | 能列出 memo，返回 tags；没有服务端标签参数，但可在 JSON 输出后本地过滤 | 复用 Chrome 登录态，从 `localStorage.me.access_token` 取 Bearer Token；调用带固定密钥的 MD5 签名私有 API | 本机 CLI + Chrome/Browser Bridge | 文档在本次调研当日仍可见，明确列出当前能力和限制；属于活跃大项目中的 adapter | **非官方方案中最适合做技术验证的 CLI**，但不宜作为无人值守生产主链路 |
| [giraffe-tree/flomo-bridge](https://github.com/giraffe-tree/flomo-bridge) | 能全量/增量读出，产出含 `tags` frontmatter 的 Markdown；博客可在本地按标签筛选 | 手工从 Web Network 复制 Bearer Token；私有 API + MD5 签名 | Obsidian Desktop 插件，本地定时同步并下载附件 | README 当前版本 1.0.5，GitHub 页面显示 43 stars / 5 forks，功能较完整 | **适合已有 Obsidian 工作流的本地中转**；仍受私有接口变化影响 |
| [fanthus/flomo2obsidian](https://github.com/fanthus/flomo2obsidian) | 能读出并可按 tag 组织输出，也支持增删改增量同步；按标签组织不等于服务端按标签取数 | 自动登录捕获 Token，或手工复制 `localStorage` access token | Obsidian Desktop 插件，本地间隔同步 | 新 fork，页面显示 0 stars / 0 forks，尚在申请社区目录；维护历史短 | 功能方向契合，但成熟度不足，暂不列为首选 |
| [Flomo Importer / flomo-to-obsidian](https://github.com/springrain1/flomo-to-obsidian) | 能通过自动化导出或手工 HTML ZIP 读出；导入后可按 Markdown 标签筛选 | Playwright 登录 flomo，或人工登录后下载导出 | Obsidian Desktop + Playwright；也可纯手工导入 | [Obsidian 社区目录](https://community.obsidian.md/plugins/flomo-importer)显示 v1.3.1、约 15k 下载，但最后更新约 2 年前 | **稳定性优先的备选**：依赖官方导出而非签名私有 API，但自动化页面流程较脆弱 |
| HTML 导出转换脚本 | 读取官方导出文件；若先按标签条件导出，则天然只含目标标签，也可解析正文标签再过滤 | 无长期 Token；人工登录导出 | 本地 Python/Node 脚本或 CI 接收导出物 | 生态多为小型 Gist，例如 [2023 脚本](https://gist.github.com/cztchoice/694a99ee8d8c3f3c4fea1261a90428f5)、[2026 脚本](https://gist.github.com/yikedu7/4644b25e5989e44d158f25446d25371e) | **最小风险的第三方辅助方案**；自动化程度低但容易审计和自行维护 |

这些项目共同证明 Web 私有接口目前可以返回正文、标签、时间戳和附件，但也直接暴露了其脆弱点。OpenCLI 文档写明：单次 `limit` 为 1–200、`since` 可按更新时间增量取数、`slug` 游标分页仍属实验、图片 URL 会过期、限制为 360 请求/小时；它还明确提醒固定 MD5 签名密钥变化会导致 adapter 失效。[OpenCLI flomo adapter](https://github.com/partme-ai/opencli/blob/main/docs/adapters/browser/flomo.md)。这些数字是**该第三方实现观察到的私有接口行为**，不是 flomo 官方 SLA。

### 5.2 只能写入 flomo 的项目与集成

GitHub 上大量名称含 “flomo API”“flomo MCP”“Obsidian to flomo”的工具只是封装官方 Incoming Webhook，把文字和标签发进 flomo。例如常见的第三方 MCP server [xianminx/mcp-server-flomo](https://github.com/xianminx/mcp-server-flomo) 的项目定位就是在 AI 对话中“create notes”；这类工具不能列出历史 memo，也不能为博客按标签拉取数据。判断项目时必须检查其工具列表是否真的存在 list/search/get，而不能只看名称中有 “API” 或 “MCP”。

同理，n8n、Make、Zapier、IFTTT 即使能通过 Webhook/HTTP 模块调用 flomo 的 Incoming Webhook，也只是**写入**。本次核查没有在它们的官方集成目录找到 flomo 原生 connector：

- [n8n integrations](https://n8n.io/integrations) 提供通用 HTTP Request/MCP 等节点，但没有发现 flomo 节点；
- [Make integrations](https://www.make.com/en/integrations) 明确建议缺少原生 app 时使用 HTTP app；目录中未发现 flomo；
- Zapier 与 IFTTT 的官方 app/服务目录搜索未发现 flomo 条目。

因此，无代码平台本身不会凭空增加读权限。要从 flomo 读出，只能让平台去调用官方 MCP（前提是平台能作为 MCP 客户端并妥善持有 Token），或者调用自行托管的同步桥；若配置私有 API，则只是把 Token 和稳定性风险转移到了第三方云端。对私人笔记而言，不建议把完整 Bearer Token交给 Make/Zapier/IFTTT 云端连接。

### 5.3 RSS / JSON Feed / 浏览器抓取器

- 没有找到由 flomo 官方提供的按标签 RSS/Atom/JSON Feed，也没有找到具有明确运营主体、隐私政策和长期维护承诺的 flomo-to-RSS 托管服务。
- GitHub 上的通用 RSS 生成器或网页抓取器，只有在目标内容已经公开时才合适；flomo 标签页需要登录，托管抓取意味着向第三方交出会话。即使生成 feed 成功，页面 DOM、验证码和反爬变化也会使其不稳定。
- OpenCLI 属于相对透明的“浏览器会话 + 私有接口 adapter”，可输出 JSON；它比 DOM 抓取稳定一些，但仍不是官方读 API。若采用，应在自己的机器运行，生成静态 JSON 后立即结束，不对公网暴露代理端点。
- 浏览器扩展/Obsidian 插件能够读取 `localStorage` Token，权限实际上等价于登录账户。安装前应审阅源码、锁定 release checksum，并使用独立 vault/受限机器；不能仅依赖 README 的“无统计”声明。

### 5.4 Notion、Obsidian、语雀中转

**Obsidian 是当前最现实的中转层。** `flomo-bridge`、`flomo2obsidian` 和 Flomo Importer 都能把 memo 变成本地 Markdown；博客随后只需扫描 frontmatter `tags`。优点是内容本地可审计、易进 Git、适配静态站点；缺点是多数自动同步仍用私有 API或浏览器自动化，而且 Obsidian Desktop 需要常驻。

**Notion 没有发现可靠的一步式 flomo 读出连接器。** 可实施的数据流是“flomo → Obsidian/导出脚本 → Notion API”，但对博客而言多加 Notion 一跳并无必要，还引入 Notion Token、block 格式转换和 API 限制。现有 Gist [dedao-flomo-notion-readwise.py](https://gist.github.com/zengjie/efd11bcac9e3f09d5e694348b49b9a3f) 的输入实际是已经位于 Notion 的 flomo 同步数据库，不是从 flomo 读取，不能作为取数器。

**语雀同样未找到一步式 flomo 读取同步器。** 语雀自身有官方 SDK/OpenAPI，并已有从语雀生成博客的成熟链路，但前半段仍需由 MCP、Obsidian 或导出脚本把 flomo 内容写入语雀。除非博客本来就以语雀为 CMS，否则不推荐为了 flomo 展示专门增加该中转层。

### 5.5 可实施候选短名单

按生产可维护性排序：

1. **官方 MCP → 仓库 JSON/Markdown（首选）**：唯一官方明确允许读取并按标签搜索的机器接口；MAX 成本换来最低合规与兼容风险。
2. **按标签官方 HTML 导出 → 小型转换脚本（无 MAX 首选）**：人工触发但数据路径清晰、无长期会话密钥；适合个人博客按周/月发布。
3. **本地 OpenCLI adapter → JSON → 严格标签过滤（实验候选）**：最接近可脚本化同步，直接输出结构化 tags/HTML，适合先做 PoC；必须接受签名、分页、图片 URL 随时失效，且只能在持有登录态的可信机器运行。
4. **Obsidian `flomo-bridge` → Markdown → 博客扫描（已有 Obsidian 时）**：无需另写解析器，支持附件和增删改；不建议仅为博客引入 Obsidian，也不建议在服务器复制完整 Token。
5. **Flomo Importer/Playwright 自动导出（保守自动化备选）**：底层走官方导出，避免直接实现签名 API；但页面自动化和两年前的维护状态使其只适合能人工介入的本地环境。

不进入短名单：云端无代码平台 + 私有 Token、第三方托管 RSS/JSON 转换、Notion/语雀多跳中转、未知来源浏览器扩展，以及仅包装 Incoming Webhook 的 SDK/MCP。它们要么不能读，要么没有比上述方案更好的风险收益比。

## 待实测清单

官方资料尚未回答以下工程问题，实施前需要用目标账号验证：

- `memo_search` 的实时输入/输出 schema、默认排序和分页游标；
- 标签参数要求 ID、全路径名还是 `#标签` 文本；
- 查询父标签是否包含所有子孙标签；
- 单次/每日调用上限以及 429 退避要求；
- MCP Token 的权限范围、有效期、轮换和撤销方式；
- 图片/音频 URL 是否公开、是否过期，能否在博客直接引用；
- 删除、编辑、改标签后如何做增量同步；
- 自动授权是否允许 CI/服务器无人值守运行。

在这些问题没有实测前，架构上应把 flomo 同步视为“可失败的内容导入任务”，而不是博客在线请求链路的一部分。
