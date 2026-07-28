# Garmin 运动快照运维

Garmin 接入由独立 Python worker 完成。worker 是唯一会解密 Garmin token、访问非官方 Garmin Connect 接口的组件；NestJS 和公开页面只读取 MySQL 中的白名单快照。

## 环境变量

worker 与本地 provision CLI 需要：

- `MYSQL_SERVER`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`
- `GARMIN_TOKEN_ENCRYPTION_KEY`：32 字节随机密钥的 Base64 文本
- `GARMIN_IS_CN`：Garmin 中国区账号设为 `true`，国际区设为 `false`

生成新密钥：

```bash
openssl rand -base64 32
```

密钥只进入本地受控环境和 Function Compute 环境变量，不写入数据库、仓库或前端配置。

## 首次部署

1. 先部署 NestJS，启动一次并确认 TypeORM 已创建 `garmin_credential`、`garmin_activity_snapshot`、`garmin_sync_state` 三张表。
2. 在 x86_64 Docker 中为 FC Python 3.12 构建 worker 依赖，然后部署 timer 仍为禁用状态的 worker：

   ```bash
   s garmin_sync build --use-docker
   s garmin_sync deploy
   ```

3. 在可信本地环境安装 worker 并进行一次交互式认证：

   ```bash
   cd workers/garmin-sync
   python3.12 -m venv .venv
   .venv/bin/pip install -e .
   .venv/bin/python -m garmin_sync.provision
   ```

   CLI 临时读取 Garmin 邮箱、密码和 MFA 验证码；成功后只把 `client.dumps()` 产生的 token JSON 以 AES-256-GCM 加密写入 MySQL。密码与 MFA 不会持久化。

4. 手动调用一次并检查日志、数据库快照和公开 `GET /garmin/stats`：

   ```bash
   s garmin_sync invoke -e '{}'
   ```

5. 验证通过后，把 [s.yaml](../s.yaml) 中 timer 的 `enable` 改为 `true` 并重新部署 `garmin_sync`。定时器每 30 分钟触发一次；数据库 advisory lock 会跳过重叠调用。

## 日常行为

- worker 每次读取账号全历史活动累计数，并完整读取最近 365 天活动列表。
- 只有 Garmin payload 明确标记为 `public` 或 `everyone` 的活动才会发布；未知隐私状态一律拒绝。
- 每次最多为 12 条尚无路线的活动补充 detail/GPX 路线，后续定时调用继续补齐。
- GPS 坐标和 GPX 字节只短暂存在内存；数据库仅保存归一化的 SVG `M/L` path 和 viewBox。
- 成功同步会对取消公开、删除或移出 12 个月窗口的活动做对账。重复执行为幂等 upsert。
- 认证错误把状态标记为 `reauth_required`；网络、限流或存储错误标记为 `degraded`。旧快照仍可读取并在超过 6 小时后显示 stale。

## 重新认证与密钥轮换

token 被撤销或失效时，重新运行：

```bash
cd workers/garmin-sync
.venv/bin/python -m garmin_sync.provision
```

轮换 `GARMIN_TOKEN_ENCRYPTION_KEY` 时：

1. 先禁用 timer；
2. 为 FC 配置新密钥并部署；
3. 本地使用同一新密钥重新运行 provision，覆盖旧加密信封；
4. 手动 invoke 验证后再启用 timer。

## 停用与回滚

优先把 timer 的 `enable` 改为 `false` 并部署。这样不会删除历史快照，公开 API 仍可返回最近一次成功数据。若需要立即隐藏页面，只移除 Landing 的 `LandingGarminStats` 组合即可；无需删除表或凭据。

日志只允许出现累计数、发布数、路线成功数和错误类别。禁止记录 token、邮箱、Garmin 原始响应、坐标、GPX/FIT 内容或请求头。
