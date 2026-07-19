---
target: /user/post 文章管理页以及 /user/page 页面管理页
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-07-19T09-41-49Z
slug: packages-frontend-src-pages-user-postlist-pagelist
---
# Critique: /user/post 文章管理 & /user/page 页面管理

Method: dual-agent (A: 78c40aa7-e04b-4751-b9ec-246bb4ca29c4 · B: cce23b47-4095-4566-a3ab-2dbc06f9a35a)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 整表被 48px spinner 替换；无骨架屏；搜索无结果与库空未区分 |
| 2 | Match System / Real World | 3 | 中文尚可；混用 `Slug`/`Footer`；副标题「管理系统…内容」偏企业后台 |
| 3 | User Control and Freedom | 2 | hook 有 reset/筛选能力但 UI 无清除；搜索无 chip |
| 4 | Consistency and Standards | 2 | Post/Page 孪生一致，但与 frost/carbon/apple-blue 令牌脱节；PageSearch 未绑定 keyword |
| 5 | Error Prevention | 2 | 整行可点易误触；无状态筛选 |
| 6 | Recognition Rather Than Recall | 2 | 编辑仅靠行点击，无显式「编辑」；标签筛选藏在 hook |
| 7 | Flexibility and Efficiency | 1 | 无快捷键、批量、排序；setLimit 未暴露 |
| 8 | Aesthetic and Minimalist Design | 2 | 六列过载；**搜索**为 primary、**新建**为 secondary |
| 9 | Error Recovery | 2 | 错误无重试；空状态无下一步 |
| 10 | Help and Documentation | 1 | 「暂无…数据」死胡同 |
| **Total** | | **20/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: Product-slop fail。读起来像通用 Tailwind 灰阶 CMS（白卡片+软阴影+uppercase 表头+pastel status+indigo 标签），不是 AppLog「干净·锐利·自信」的写作工具。触碰 anti-ref「厚重 SaaS 后台感」。非 landing 式 AI 花活，而是 category-reflex admin。

**Deterministic scan**: `detect.mjs` 对 PostList/PageList/components 扫描 **0 findings / exit 0**。`--no-config` 对照亦为空。LLM 指出的 ghost-card、uppercase tracked headers、indigo tags 均在 Vue `<style scoped>` 中——检测器对此表面呈盲区，**不以 clean 否定设计问题**。

**Visual overlays**: 不可用。两端评估均未能稳定打开 cursor-ide-browser 标签；live-server/detect.js 注入未执行。无 [Human] overlay。

## Overall Impression

可识别的后台列表骨架（标题→搜索→表→分页），IA 比典型 SaaS dashboard 干净；但主 CTA 反转、空/错死胡同、行点击不可键盘达，以及与设计令牌脱节，使「作者管自己的稿」听起来像「企业 CMS」。最大机会：把「新建」做成唯一 filled apple-blue，并把表砍到作者真正需要的列。

## What's Working

1. **IA 清晰**：顶栏 user nav（概览/文章/页面/评论）任务入口明确。
2. **结构克制**：无卡片墙/指标条，比典型 dashboard 干净。
3. **共享分页**：AdminPagination + 中文上一页/下一页，工具感方向对。

## Priority Issues

### [P1] 主操作层级反转
- **What**: PostSearch/PageSearch 中「搜索」= default filled primary，「新建文章/页面」= secondary。
- **Why**: 作者峰值是写新稿，不是搜索。
- **Fix**: 新建 → primary（apple-blue）；搜索 → outline/ghost 或 Enter；新建可上移页头右侧。
- **Suggested command**: `$impeccable layout`

### [P1] 空状态与错误状态是死胡同
- **What**: 「暂无文章/页面数据」；错误红盒无重试。
- **Why**: 首次进后台或接口失败时任务中断。
- **Fix**: 空态人话 + 新建主按钮；区分无结果 vs 库空；错误加重试。
- **Suggested command**: `$impeccable onboard` / `$impeccable harden`

### [P1] 行点击编辑不可达 / 不可发现
- **What**: 表行仅 `@click`，无 tabindex/role/keydown，无行内「编辑」。
- **Why**: 键盘用户无法完成主路径；鼠标用户也要猜整行可点。
- **Fix**: 行用链接语义；Enter/Space；末列显式「编辑」。
- **Suggested command**: `$impeccable audit` / `$impeccable harden`

### [P2] 视觉系统 = 灰阶 SaaS，非 frost/carbon 工具
- **What**: 白卡片阴影、uppercase 表头、indigo 标签、彩虹 status pills；未用设计令牌。
- **Why**: 厚重 SaaS；与主站气质断裂。检测器未报，但源码明确存在。
- **Fix**: 平表面或 1px hairline；去掉 soft shadow；标签/状态收敛到品牌中性色 + 单一 accent。
- **Suggested command**: `$impeccable quieter` / `$impeccable colorize`

### [P2] 能力与 UI 脱节 + 列过载
- **What**: setTags/resetQuery/setLimit 有 hook 无 UI；文章表摘要+作者对单人博客噪声；PageSearch 未传 keyword；Footer/Slug 英文混用。
- **Why**: 认知负荷；翻译成本。
- **Fix**: 默认紧凑列（标题·状态·更新时间）；状态筛选；清除搜索；Footer→页脚。
- **Suggested command**: `$impeccable distill` / `$impeccable clarify`

## Persona Red Flags

**Alex（Power User）**: 无批量/排序/状态筛选/快捷键；新建弱于搜索；分页 sibling-count=2 噪音。

**Sam（A11y）**: 表行仅鼠标；状态靠颜色；加载无 aria-busy；搜索仅 placeholder 无 label。

**作者 Author（自己的博客）**: 「作者」列多余；「管理系统…内容」像企业后台；indigo 标签与品牌蓝冲突；管理页仍挂公共 Footer。

## Minor Observations

- PostSearch 有 `:keyword`，PageList 的 PageSearch 未传 → 回填不一致。
- 页面 placeholder 提「摘要」但表无摘要列。
- Header 站点标题点击跳公开列表，易跳出管理上下文。
- 移动端仅横向滚表，无堆叠替代。

## Questions to Consider

1. 若「新建」是唯一 filled apple-blue，这页是否立刻更像写作工具？
2. 单人作者是否只需「标题 · 状态 · 更新时间」三列？
3. 空状态写成「还没有文章。写第一篇？」是否更像人？
4. Post/Page 是否应共用 AdminListShell，只换列配置？
