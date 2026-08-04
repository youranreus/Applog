# Applog OIDC 登录改造设计

## Architecture

登录协议完全由后端 `UserModule` 所属的 OIDC 适配层负责。前端只发起登录、承接完成页并保存 Applog 自有 JWT，不接触 H Token Endpoint、ID Token 或 Access Token。

```text
Login.vue
  -> GET backend /user/oidc/login
  -> H authorization_endpoint
  -> GET backend /user/oidc/callback
  -> H token_endpoint + JWKS verification
  -> encrypted HttpOnly completion session
  -> frontend /user/callback
  -> POST backend /user/oidc/complete
  -> Applog JWT + local user
```

## Backend Boundaries

### OIDC client

- 新增 `openid-client`，通过 `OIDC_ISSUER`、`OIDC_CLIENT_ID` 和可选 `OIDC_CLIENT_SECRET` 初始化 Discovery config。
- public client 使用 `None()`；confidential client 仅使用指南允许的 `client_secret_post`。
- Discovery config 在进程内复用；初始化失败不得回退到硬编码端点。
- 授权 URL 始终包含 `response_type=code`、`scope=openid profile email`、随机 `state`、随机 `nonce`、S256 challenge。
- 回调把真实请求 URL（包括 provider 返回的 `iss`）传给 `authorizationCodeGrant`，并同时提供 expected state、nonce 和 verifier。

### Temporary session

- 使用 Fastify 加密 HttpOnly session cookie 保存短期 OIDC transaction：`state`、`nonce`、`codeVerifier`、创建时间和受限的站内 return path。
- 回调兑换前读取 transaction；成功或失败后均清除 transaction，cookie 设置 `HttpOnly`、生产环境 `Secure`、合适的 `SameSite` 和短 TTL。
- 回调成功后只把短期 completion 结果写入加密 session，并跳转到 `FRONT_URL/user/callback`；URL 不携带 JWT、ID Token 或上游 token。
- `POST /user/oidc/complete` 原子取出并删除 completion，返回现有 `ILoginResponseDto`。重复完成请求失败。
- CORS 仅对配置的 `FRONT_URL` 开启 credentials；现有普通 API 仍接受 Bearer JWT。

### Identity mapping

- `UserEntity` 新增 nullable `oidcIssuer` 与 `oidcSubject`，建立组合唯一索引；保留 `ssoId` 作为兼容字段并改为 nullable。
- 正常查找先按 `(issuer, sub)`。
- 兼容绑定仅在未找到 OIDC identity、`sub` 是旧 H 数字 ID、且对应 `ssoId` 用户尚未绑定 OIDC identity 时执行；更新同一行，不改变本地 `id` 和 `role`。
- 没有兼容用户时创建新用户，角色固定为 `user`。昵称、头像、已验证邮箱来自经过 OIDC 客户端校验的 claims。
- 已有用户登录只同步昵称、头像和邮箱等资料，不用 OIDC claims 覆盖本地角色。
- 对并发首次登录依赖数据库唯一约束并在冲突后重新读取身份，避免重复用户。

## Frontend Boundaries

- `login()` 改为导航到后端 `/user/oidc/login`，只传经过限制的站内 return path；移除 `VITE_SSO_LOGIN_URL`、`VITE_SSO_CALLBACK_URL`、`VITE_SSO_CLIENT_ID`。
- `Callback.vue` 不再读取 provider 的 `code/state`，而是调用新的 complete API；成功后沿用 `setToken`、用户缓存和原路返回逻辑。
- complete API 单独启用 credentials，以便发送 HttpOnly 临时 session cookie。
- 登录失败只显示 Applog 后端提供的安全错误文本，并允许回到登录页重新开始完整流程，而不是重放 callback。

## Configuration

后端新增并校验：

- `OIDC_ISSUER=https://h.exia.xyz/oidc`
- `OIDC_CLIENT_ID`
- `OIDC_REDIRECT_URI`，必须是后端 callback 的精确 HTTPS 地址
- `OIDC_SESSION_SECRET`，至少 32 字节，仅服务端使用
- 可选 `OIDC_CLIENT_SECRET`
- `FRONT_URL`，用于严格 CORS origin 和完成后重定向

移除运行时使用的旧 `SSO_ID`、`SSO_URL`、`SSO_SECRET`、`SSO_REDIRECT` 及前端 `VITE_SSO_*`。

## Compatibility And Rollout

- 数据库当前使用 TypeORM `synchronize: true`，因此只做兼容性加列和索引，不在同一发布中重命名或删除 `ssoId`。
- 发布前先在 H 子应用配置中登记后端 callback 精确地址，并准备新环境变量。
- 部署后先用既有管理员 H 账号登录，确认绑定到原本地行且角色仍为 admin，再开放普通用户登录。
- 回滚时旧字段和内容关系仍存在；代码可回退到旧 SSO 版本，但新建的纯 OIDC 用户没有旧 `ssoId`，旧版本无法让这些账号登录。数据本身不删除。

## Security And Privacy

- 不记录 code、verifier、state、nonce、client secret、ID Token、Access Token 或 Applog JWT 原文。
- return path 只允许以单个 `/` 开头的站内路径，拒绝协议相对 URL、绝对 URL 和反斜杠变体。
- 仅接受 `email_verified === true` 且存在 `sub`；缺少可选 nickname/picture 时使用安全 fallback。
- 所有 OIDC 错误在边界归一化为有限的用户消息，详细错误仅以无敏感数据的分类日志记录。

## Trade-offs

- 继续使用 Bearer JWT 可限制改造面；短期加密 session 只承担 OIDC transaction/completion，不成为长期认证状态。
- 加密 cookie session 不需要新增 Redis，但多实例部署必须共享相同 session secret；授权码的一次性语义由 H 保证，completion 由成功后清除 cookie 保证正常浏览器路径的一次性。
- 暂留 `ssoId` 增加一个过渡字段，但避免依赖当前 `synchronize: true` 做破坏性列迁移。
