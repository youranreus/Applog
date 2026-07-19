# PRD: 文章/页面管理页 UX 打磨

## 背景

`$impeccable critique` 对 `/user/post` 与 `/user/page` 打出 **20/40（Acceptable）**。用户选择：

1. 优先修操作层级（新建 vs 搜索）
2. 语气偏「我的稿子」写作空间（非企业 CMS）
3. 范围：P1 + P2 全做

Critique snapshot: `.impeccable/critique/2026-07-19T09-41-49Z__packages-frontend-src-pages-user-postlist-pagelist.md`

## 目标

把两页从「灰阶 SaaS 后台」收成「作者管自己的稿」的轻量工具面，对齐 frost/carbon/apple-blue。

## 验收标准

### P1

- [x] 「写新文章 / 新建页面」为唯一 filled primary（apple-blue），置于页头右侧
- [x] 搜索为图标 + Enter 提交（无独立搜索按钮）；有清除筛选
- [x] 空状态：库空有人话 + 主按钮；搜索无结果可区分并可清除
- [x] 错误态有「重试」
- [x] 表行键盘可达（tabindex + Enter/Space + aria-label）；不做行内「编辑」按钮（晚近 UX 确认）

### P2

- [x] 去掉表卡片 soft shadow；表头非 uppercase tracked；去掉 indigo 标签彩虹
- [x] 默认列：标题 · Slug · 状态 · 更新（页面另加「作用于」：导航/页脚）；去掉作者/摘要/浏览与行内编辑列
- [x] 文案偏「我的稿子」；`Footer` →「页脚」；两页结构对齐；页头标题 wave 装饰
- [x] 共享 `AdminListSearch` 绑定 keyword 回填；分页当前页无 outline 边框高亮

### 明确不做（本任务）

- 后端 status 查询参数（当前 API 无 status filter；本任务用清除搜索满足筛选出口）
- 批量操作 / 快捷键体系
- 管理壳去掉公共 Footer（更大布局改动，另开）

## 范围文件

- `packages/frontend/src/pages/user/PostList/**`
- `packages/frontend/src/pages/user/PageList/**`
- `packages/frontend/src/pages/user/components/**`（共享头/搜/错）
