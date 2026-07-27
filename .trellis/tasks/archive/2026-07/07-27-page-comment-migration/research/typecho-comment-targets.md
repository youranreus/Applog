# Typecho 评论目标研究

## Primary sources

1. Typecho 官方 MySQL 安装 schema：<https://github.com/typecho/typecho/blob/master/install/Mysql.sql>
   - `typecho_comments.cid` 有索引，评论表本身没有文章/页面类型列。
   - `typecho_contents.cid` 是内容主键，`type` 默认 `post`，同表还保存页面内容。
   - `commentsNum` 与 `allowComment` 也位于统一 contents 记录上。
2. Typecho 官方反馈处理：<https://github.com/typecho/typecho/blob/master/var/Widget/Feedback.php>
   - 反馈入口匹配任意 single content，并用 `$this->content->cid` 写入评论 `cid`。
   - 官方逻辑显式处理 `page:<cid>` 作为首页的评论来源校验，说明页面使用相同评论机制。

## Conclusion

迁移时必须把 comments 与 contents 按 cid 联结，并用 contents.type 决定 AppLog 的 Post 或 Page 目标。只扫描 AppLog 文章 `extra.originalId` 会系统性漏掉 Typecho 页面评论；依靠 slug/title 推断也不符合源数据契约。
