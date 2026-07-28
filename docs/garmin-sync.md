# Garmin 运动快照运维

Garmin 接入由独立 Python worker 完成。生产环境默认在 Linux 服务器上通过 systemd oneshot service 和 timer 运行，不依赖阿里云 Function Compute。worker 是唯一会解密 Garmin token、访问非官方 Garmin Connect 接口的组件；NestJS 和公开页面只读取 MySQL 中的白名单快照。

## 运行条件

- Linux 服务器，推荐带 systemd 的发行版
- Python 3.12
- 能访问 Garmin Connect HTTPS 接口和项目 MySQL
- 与 NestJS 使用同一 MySQL 数据库
- 专用的低权限系统用户，例如 `applog`

worker 默认与 NestJS 共用 `packages/backend/.env`。在现有文件中追加 Garmin 专用配置即可；MySQL 配置直接复用：

- `MYSQL_SERVER`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`
- `GARMIN_TOKEN_ENCRYPTION_KEY`：32 字节随机密钥的 Base64 文本
- `GARMIN_IS_CN`：Garmin 中国区账号设为 `true`，国际区设为 `false`

生成加密密钥：

```bash
openssl rand -base64 32
```

密钥只进入服务器受控环境和可信的首次认证环境，不写入数据库、仓库、日志或前端配置。生产环境中的 `packages/backend/.env` 应只允许部署用户和 `applog` 组读取，例如权限设为 `0640`。

worker 启动器默认按仓库结构定位该文件；如果部署时配置文件在其他位置，可用 `GARMIN_ENV_FILE` 指定绝对路径。已经由 systemd、容器或 shell 注入的环境变量优先于 `.env` 中的同名值。

```ini
MYSQL_SERVER=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=applog
MYSQL_PASSWORD=replace-with-database-password
MYSQL_DATABASE=applog
GARMIN_TOKEN_ENCRYPTION_KEY=replace-with-base64-key
GARMIN_IS_CN=true
```

## 首次部署

1. 先部署并启动 NestJS，确认 TypeORM 已创建 `garmin_credential`、`garmin_activity_snapshot`、`garmin_sync_state` 三张表。

2. 在服务器创建独立虚拟环境并安装 worker。下面假设项目发布目录为 `/opt/applog/current`：

   ```bash
   sudo install -d -o applog -g applog /opt/applog/venvs
   sudo -u applog python3.12 -m venv /opt/applog/venvs/garmin-sync
   sudo -u applog /opt/applog/venvs/garmin-sync/bin/pip install \
     /opt/applog/current/workers/garmin-sync
   ```

   每次发布包含 worker 变更时，重新执行最后一条 `pip install`，并增加 `--upgrade`。

3. 确认启动器可执行：

   ```bash
   chmod +x /opt/applog/current/workers/garmin-sync/start-worker
   ```

4. 安装 `/etc/systemd/system/applog-garmin-sync.service`：

   ```ini
   [Unit]
   Description=AppLog Garmin activity snapshot sync
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=oneshot
   User=applog
   Group=applog
   WorkingDirectory=/opt/applog/current/workers/garmin-sync
   Environment=GARMIN_PYTHON_BIN=/opt/applog/venvs/garmin-sync/bin/python
   ExecStart=/opt/applog/current/workers/garmin-sync/start-worker sync
   TimeoutStartSec=5min
   NoNewPrivileges=true
   PrivateTmp=true
   ProtectSystem=strict
   ProtectHome=true

   [Install]
   WantedBy=multi-user.target
   ```

5. 安装 `/etc/systemd/system/applog-garmin-sync.timer`。首次验证前不要启动 timer：

   ```ini
   [Unit]
   Description=Run AppLog Garmin sync every 30 minutes

   [Timer]
   OnCalendar=*:0/30
   Persistent=true
   RandomizedDelaySec=2min
   AccuracySec=1min
   Unit=applog-garmin-sync.service

   [Install]
   WantedBy=timers.target
   ```

6. 重新加载 systemd 配置：

   ```bash
   sudo systemctl daemon-reload
   ```

7. 在可信终端完成一次交互式 Garmin 登录。使用 transient service 可以复用正式 worker 的用户和 Python 环境，同时保留邮箱、密码和 MFA 的交互输入：

   ```bash
   sudo systemd-run --pty --wait --collect \
     --unit=applog-garmin-provision \
     --property=User=applog \
     --property=Group=applog \
     --property=WorkingDirectory=/opt/applog/current/workers/garmin-sync \
     /usr/bin/env GARMIN_PYTHON_BIN=/opt/applog/venvs/garmin-sync/bin/python \
     /opt/applog/current/workers/garmin-sync/start-worker provision
   ```

   CLI 临时读取 Garmin 邮箱、密码和 MFA 验证码；成功后只把 `client.dumps()` 产生的 token JSON 以 AES-256-GCM 加密写入 MySQL。密码与 MFA 不会持久化。

8. 手动运行一次 worker，并检查状态、日志、数据库快照和公开 `GET /garmin/stats`：

   ```bash
   sudo systemctl start applog-garmin-sync.service
   sudo systemctl status applog-garmin-sync.service
   sudo journalctl -u applog-garmin-sync.service -n 100 --no-pager
   ```

9. 验证通过后启用每 30 分钟一次的 timer：

   ```bash
   sudo systemctl enable --now applog-garmin-sync.timer
   systemctl list-timers applog-garmin-sync.timer
   ```

   systemd 不会并发启动同一个 oneshot service；数据库 advisory lock 也会跳过来自其他节点或手动触发的重叠调用。

项目 [s.yaml](../s.yaml) 中的 `garmin_sync` Function Compute timer 保持禁用，不属于服务器部署流程，不要在阿里云侧启用它。

## 日常检查

```bash
systemctl status applog-garmin-sync.timer
systemctl list-timers applog-garmin-sync.timer
sudo journalctl -u applog-garmin-sync.service --since today
```

- worker 每次读取账号全历史活动累计数，并完整读取最近 365 天活动列表。
- 只有 Garmin payload 明确标记为 `public` 或 `everyone` 的活动才会发布；未知隐私状态一律拒绝。
- 每次最多为 12 条尚未处理路线的跑步活动补充 detail/GPX 路线，后续定时调用继续补齐。
- GPS 坐标和 GPX 字节只短暂存在内存；数据库仅保存归一化的 SVG `M/L` path 和 viewBox。
- 成功同步会对取消公开、删除或移出 12 个月窗口的活动做对账。重复执行为幂等 upsert。
- 认证错误把状态标记为 `reauth_required`；网络、限流或存储错误标记为 `degraded`。旧快照仍可读取并在超过 6 小时后显示 stale。

## 重新认证

token 被撤销或失效时，先停用 timer，再重新运行首次部署中的 transient provision 命令：

```bash
sudo systemctl disable --now applog-garmin-sync.timer
```

认证完成后手动启动一次 service；验证成功再恢复 timer：

```bash
sudo systemctl start applog-garmin-sync.service
sudo systemctl enable --now applog-garmin-sync.timer
```

## 加密密钥轮换

1. 停用 timer。
2. 生成新密钥并更新 `packages/backend/.env`。
3. 使用同一新密钥重新运行 provision，覆盖数据库中的旧加密信封。
4. 手动启动 service 并检查公开 API。
5. 验证通过后恢复 timer。

不要只修改环境变量后直接启动 worker：旧 token 无法用新密钥解密，会导致同步失败。

## 停用与回滚

停止后续同步但保留现有快照：

```bash
sudo systemctl disable --now applog-garmin-sync.timer
```

这不会删除历史快照，公开 API 仍可返回最近一次成功数据，并在超过 6 小时后标记 stale。若需要立即隐藏页面，只移除 Landing 的 `LandingGarminStats` 组合即可；无需删除表或凭据。

如需移除服务器调度配置，可在 timer 已停止后删除两个 unit 文件并执行 `sudo systemctl daemon-reload`；是否删除数据库快照和加密凭据应作为单独的数据清理操作处理。

日志只允许出现累计数、发布数、路线成功数、耗时、request id 和错误类别。禁止记录 token、邮箱、Garmin 原始响应、坐标、GPX/FIT 内容或请求头。
