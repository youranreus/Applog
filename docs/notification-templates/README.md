# AppLog 评论邮件模板

本目录是 H 后台两份评论邮件模板的权威版本化来源。应用只发送模板键和下表列出的字符串变量，不发送 IP、邮箱、User-Agent、凭证或原始 HTML。

## `applog-comment-status`

建议主题：`你的评论审核结果：{{statusLabel}}`

| 变量 | 含义 |
| --- | --- |
| `commenterName` | 评论者显示名 |
| `targetTitle` | 文章或页面标题 |
| `targetType` | `文章` 或 `页面` |
| `statusLabel` | `已通过` 或 `已拒绝` |
| `commentExcerpt` | 单行纯文本摘要，最多 160 个 Unicode 码点 |
| `viewUrl` | 已通过时带评论锚点；已拒绝时只指向目标 |

建议纯文本：`{{commenterName}}，你在{{targetType}}《{{targetTitle}}》下的评论{{statusLabel}}：{{commentExcerpt}}。查看：{{viewUrl}}`

## `applog-new-comment`

建议主题：`{{siteName}} 收到新评论`

| 变量 | 含义 |
| --- | --- |
| `siteName` | 系统标题，缺失时为 `Applog` |
| `targetTitle` | 文章或页面标题 |
| `targetType` | `文章` 或 `页面` |
| `commenterName` | 评论者显示名 |
| `commentExcerpt` | 单行纯文本摘要，最多 160 个 Unicode 码点 |
| `adminUrl` | 评论管理页链接 |

建议纯文本：`{{siteName}} 的{{targetType}}《{{targetTitle}}》收到 {{commenterName}} 的评论：{{commentExcerpt}}。管理：{{adminUrl}}`

## 手工发布清单

1. 在 H 管理后台确认当前支持的、默认 HTML 转义的占位符语法；若不是 `{{variable}}`，只在粘贴发布时按 H 的语法替换，不修改变量名。
2. 创建或更新模板键 `applog-comment-status` 和 `applog-new-comment`，粘贴对应 HTML，并配置上述建议主题及纯文本版本。
3. 确认 AppLog 应用策略允许两份模板和手动 Email 收件人。
4. 发布模板后，分别发送一次审核结果事件和新评论事件，检查移动端、桌面端与纯文本降级。
5. 验证链接、中文标签、转义后的用户输入，并确认邮件中不出现邮箱、IP、User-Agent 或凭证。
6. 最后在 AppLog 系统设置中保存新签发的 mail token 并启用通知。

模板更新必须同时评审后端变量契约与本目录两份 HTML；H 发布为人工操作，不由仓库脚本同步。
