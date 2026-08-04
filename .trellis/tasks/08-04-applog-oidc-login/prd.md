# 改造 Applog OIDC 登录流程

## Goal

让 Applog 按 H 第三方 OIDC 指南完成安全的服务端登录：浏览器通过 Authorization Code + S256 PKCE 登录 H，Applog 后端校验回调并建立自己的登录凭证，同时保留现有管理页面和 JWT 访问控制体验。

## Confirmed Facts

- 当前前端在 `packages/frontend/src/stores/useUserStore/index.ts` 直接拼接 SSO 登录 URL，回调后把 `code` 当作 ticket 调用 `GET /user/login`。
- 当前后端 `packages/backend/src/module/user/user.service.ts` 使用 `@reus-able/sso-utils` 以 ticket 换 access token，再读取用户信息并签发 Applog JWT。
- 当前 `UserEntity.ssoId` 是数值列且唯一；H OIDC 的稳定身份标识是 opaque string `sub`，不能继续假设它可转为数字。
- H Discovery 声明只提供 `openid profile email`，ID Token claims 为 `sub`、`nickname`、`picture`、`email`、`email_verified`，不提供角色 claim。
- H 接入要求服务端生成并保存一次性 `state`、`nonce`、`code_verifier`，使用 Discovery 返回的端点，以 OIDC 客户端完成签名、`iss`、`aud`、有效期和 `nonce` 校验。
- Applog 现有用户文章、页面和评论均通过本地数据库用户自增 `id` 关联，不能因身份迁移改变本地用户主键。

## Requirements

1. 后端提供登录入口和回调入口；Discovery、授权端点、Token 端点和 JWKS 地址均从 `OIDC_ISSUER` Discovery 获取，不硬编码路径。
2. 登录请求必须使用 `response_type=code`、`scope=openid profile email`、`code_challenge_method=S256`，并对 `state`、`nonce`、PKCE verifier 做一次性、过期和绑定校验。
3. 回调必须在服务端使用 OIDC 客户端兑换并验证 ID Token，保留并验证完整的 issuer（`iss`），不得只 Base64 解码 token，也不得把上游 access token 暴露给浏览器。
4. 以 `(issuer, sub)` 作为外部身份稳定键；首次登录时创建或绑定本地用户，后续登录更新允许的资料字段并签发 Applog 自有认证凭证。
5. 将旧 `ssoId` 数据平滑迁移到字符串身份字段，保留已有本地用户、内容关系和角色；旧 ticket 登录路径和旧 SSO 配置在切换策略明确后移除或关闭。
6. 前端登录页只触发后端登录入口；回调页只处理后端完成 OIDC 后返回的 Applog 登录结果，不在浏览器实现 PKCE 或访问 H Token 端点。
7. 认证失败、state/nonce/verifier 不匹配、重复使用授权码和不完整配置均返回不泄露上游细节的错误，并写入服务端结构化日志。
8. 首次通过 H OIDC 登录且没有本地身份绑定的账号自动创建为普通用户；OIDC claims 不参与 Applog 角色计算，管理员权限仅来自本地已有角色或后续本地授予。

## Acceptance Criteria

- [ ] 未登录用户点击登录后进入 H 授权页，授权请求可验证包含 `response_type=code`、`scope=openid profile email`、`code_challenge_method=S256`，且不包含 client secret。
- [ ] 正常回调可完成 Discovery 端点兑换、ID Token 验证、本地用户解析和 Applog JWT 登录；刷新页面后现有受保护路由仍可访问。
- [ ] 使用错误或过期 `state`、错误 verifier、错误 nonce、错误 issuer/audience 的回调均失败；同一授权码第二次兑换失败。
- [ ] H 的非数字 `sub` 可以创建并稳定解析为同一 Applog 用户；已有用户的文章、页面、评论和本地角色不变。
- [ ] 浏览器网络、URL、localStorage/sessionStorage 和日志中不出现 H client secret、上游 access token 或 ID Token 原文。
- [ ] 后端、前端和数据库迁移专项测试通过；至少覆盖 Discovery 缓存/失败、回调错误分支、身份幂等和旧数据迁移。

## Out of Scope

- 不把 H 的角色或权限体系同步到 Applog。
- 不引入 Refresh Token；H 当前不签发 Refresh Token，Applog 继续管理自己的 JWT 生命周期。
- 不在本次改造中把所有 API 从 Bearer JWT 迁移为长期 Cookie Session。
- 不增加多 OIDC Provider 管理后台；本次仅通过服务端环境变量配置一个 H Issuer。
- 不删除旧 `ssoId` 数据列；先完成兼容绑定，待生产数据全部迁移后另行清理。
