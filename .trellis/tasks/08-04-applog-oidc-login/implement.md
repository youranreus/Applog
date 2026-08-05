# Applog OIDC 登录改造实施计划

## 1. Backend Protocol Foundation

- [x] 安装并锁定 `openid-client`；使用 AES-256-GCM 加密短期 HttpOnly transaction/completion cookie。
- [x] 新增 OIDC 配置读取、启动时校验和 Discovery client owner；public/confidential client 分支符合 H 指南。
- [x] 注册加密 HttpOnly session 与基于 `FRONT_URL` 的 credentialed CORS。
- [x] 增加 return path 规范化、transaction TTL、cookie 属性、篡改拒绝和 HTTPS callback 测试。

## 2. Identity Compatibility

- [x] 为 `UserEntity` 增加 `oidcIssuer`、`oidcSubject` 和组合唯一索引，使旧 `ssoId` nullable 但保留。
- [x] 将旧 SSO 登录逻辑拆除，新增按 issuer/sub 查找、旧数字 subject 渐进绑定、新用户普通角色创建和资料同步。
- [x] 已覆盖角色保留、opaque subject 和真实 Provider claims；并发唯一冲突验证由用户接受延期。
- [x] 全局搜索 `ssoId` 消费者，通过共享 `getUserPublicId` 投影统一 Post/Page/Comment 与前端作者 ID 类型。

## 3. Backend Login Endpoints

- [x] 新增 `GET /user/oidc/login`：生成 transaction 并重定向到 Discovery authorization endpoint。
- [x] 新增 `GET /user/oidc/callback`：校验 transaction、从已登记 HTTPS callback 合成完整返回 URL、解析身份并生成 completion，然后重定向前端。
- [x] 新增 `POST /user/oidc/complete`：一次性返回 `ILoginResponseDto` 并清除 completion。
- [x] 删除 `GET /user/login?ticket=`、`LoginDto` 和 `@reus-able/sso-utils` 依赖。
- [x] controller double 已覆盖安全 return path、generic callback failure、cookie 清除和重复/过期 completion；完整 Discovery/claims client-double 矩阵由用户接受延期。

## 4. Frontend Flow

- [x] 新增 OIDC login/complete API owner，complete 请求启用 credentials。
- [x] 简化 `useUserStore.login()` 和 callback handler，保留 JWT/user 缓存、auth bootstrap 与 redirect 恢复。
- [x] 更新 `Login.vue`、`Callback.vue` 文案和失败重试行为；失败重试重新开始登录，不重放回调。
- [x] 删除旧 `ISsoCallbackParams`、ticket state、exchange API 和 `VITE_SSO_*` 类型/配置。
- [x] 增加前端 OIDC 静态/单元回归，覆盖 callback 不读取 provider code/state、不使用浏览器 redirect storage，以及站内 redirect 规范化；complete 成功/失败由后端 controller 回归覆盖。

## 5. Configuration And Operations

- [x] 更新后端示例/本地环境契约、`CLAUDE.md` 和 `s.yaml`，透传 `OIDC_*`、`FRONT_URL`，不把 secret 写入前端构建环境。
- [x] 已透传部署配置；完整 preflight、健康验证和失败恢复由用户接受延期，不作为本任务归档门槛。
- [x] 记录 H 子应用需登记的精确 callback URL，以及 public/confidential client 对应配置。
- [x] 实体兼容设计与自动化检查已完成；隔离 MySQL、旧管理员绑定和回滚实测由用户接受延期。

## 6. Validation And Review

- [x] `pnpm --filter @applog/backend run test:unit`（88/88，含 Fastify 空 JSON completion 回归）
- [x] `pnpm --filter @applog/backend run lint`
- [x] `pnpm --filter @applog/backend run build`
- [x] `pnpm --filter @applog/frontend run test:unit`（34/34）
- [x] `pnpm --filter @applog/frontend run type-check`
- [x] `pnpm --filter @applog/frontend run lint`
- [x] `pnpm --filter @applog/frontend run build`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] 2026-08-06 由用户完成浏览器验收，URL、storage、请求/响应和 console 未发现上游 token、ID Token 或 client secret 泄露。
- [x] 2026-08-06 使用 H 正式 Issuer 和已登记子应用完成真实 Authorization Code + S256 登录，用户确认验收通过。

## Risk And Rollback Points

- Entity 变更前后分别检查目标 MySQL schema；不得直接在共享生产库试验破坏性同步。
- 首次真实回调前确认 H 登记 URI 与 `OIDC_REDIRECT_URI` 字节级一致。
- 保留旧 `ssoId` 是本次数据库回滚锚点；不得在本任务中删除或批量重写旧值。
- 若真实 OIDC 验收受网络或浏览器扩展影响，专项自动测试仍需完整通过，并把真实验收明确保留为未完成项，不能用关闭 issuer/nonce 校验代替。
