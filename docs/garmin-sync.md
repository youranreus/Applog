# Garmin 运动快照运维

Garmin 接入由独立 Python worker 完成。生产环境默认在 Linux 服务器上通过 systemd oneshot service 和 timer 运行，不依赖阿里云 Function Compute。worker 是唯一会解密 Garmin token、访问非官方 Garmin Connect 接口的组件；NestJS 和公开页面只读取 MySQL 中的白名单快照。

## 运行条件

- Linux 服务器，推荐带 systemd 的发行版
- Python 3.12
- 能访问 Garmin Connect HTTPS 接口和项目 MySQL
- 与 NestJS 使用同一 MySQL 数据库
- 专用的低权限系统用户，例如 `applog`

worker 默认与 NestJS 共用 `packages/backend` 下的环境配置文件。在当前生效的高优先级文件（例如 `.env.development.local`）中追加 Garmin 专用配置即可；MySQL 配置直接复用：

- `MYSQL_SERVER`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`
- `GARMIN_TOKEN_ENCRYPTION_KEY`：32 字节随机密钥的 Base64 文本
- `GARMIN_IS_CN`：Garmin 中国区账号设为 `true`，国际区设为 `false`

生成加密密钥：

```bash
openssl rand -base64 32
```

密钥只进入服务器受控环境和可信的首次认证环境，不写入数据库、仓库、日志或前端配置。生产环境中实际生效的 `.env*` 文件应只允许部署用户和 worker 运行组读取，例如权限设为 `0640`。

worker 启动器默认按仓库结构定位 `packages/backend`，并使用与 NestJS 相同的从高到低优先级：

```text
.env.production.local
.env.development.local
.env.production
.env.development
.env
```

前面的文件已经提供同名变量时，后面的文件不会覆盖它；systemd、容器或 shell 显式注入的环境变量又高于所有 `.env` 文件。如果部署时配置目录在其他位置，可用 `GARMIN_ENV_DIR` 或注册参数 `--env-dir` 指定绝对路径。`GARMIN_ENV_FILE` / `--env-file` 会改为只读取一个明确文件，通常不建议在标准部署中使用。

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

2. 确保低权限运行用户和 `packages/backend` 下当前生效的环境配置已经存在。下面假设运行用户为 `applog`、项目发布目录为 `/opt/applog/current`。

3. 执行首次部署脚本：

   ```bash
   cd /opt/applog/current/workers/garmin-sync
   sudo ./bootstrap \
     --user applog \
     --python /usr/bin/python3.12 \
     --venv /opt/applog/venvs/garmin-sync
   ```

   bootstrap 会创建或更新虚拟环境、安装 worker、注册并确保 systemd timer 处于关闭状态、交互读取 Garmin 邮箱/密码/MFA、加密保存 token，并执行一次同步。它不会把密码或 MFA 写入磁盘。

   如果已有虚拟环境不完整（例如存在 `bin/python` 但缺少 pip），bootstrap 会先尝试通过 Python 自带的 `ensurepip` 修复；若 `/usr/local` 等自编译 Python 没有包含 `ensurepip`，则使用基础 Python 的 pip（需要 22.3 或更高版本）直接为目标虚拟环境安装 pip。修复后原样重跑 bootstrap 即可，不需要手动调用虚拟环境中的 `bin/pip`。

   如果配置目录不在默认位置，追加 `--env-dir /absolute/path/to/backend-config`；若已完成 token provision，可用 `--skip-provision`；若只想完成安装和注册，可再加 `--skip-sync`。重复运行 bootstrap 会更新依赖和 unit、关闭 timer，并默认再次进入 provision，因此常规发布建议使用 `--skip-provision`，验证完成后重新 enable。

4. 检查首次同步状态、日志、数据库快照和公开 `GET /garmin/stats`：

   ```bash
   sudo systemctl status applog-garmin-sync.service
   sudo journalctl -u applog-garmin-sync.service -n 100 --no-pager
   ```

5. 验证通过后启用每 30 分钟一次的 timer：

   ```bash
   cd /opt/applog/current/workers/garmin-sync
   sudo ./manage-timer enable
   ./manage-timer status
   ```

   systemd 不会并发启动同一个 oneshot service；数据库 advisory lock 也会跳过来自其他节点或手动触发的重叠调用。

项目 [s.yaml](../s.yaml) 中的 `garmin_sync` Function Compute timer 保持禁用，不属于服务器部署流程，不要在阿里云侧启用它。

## 日常检查

```bash
cd /opt/applog/current/workers/garmin-sync
./manage-timer status
sudo journalctl -u applog-garmin-sync.service --since today
```

- worker 每次读取账号全历史活动累计数，并完整读取最近 365 天活动列表。
- 只有 Garmin payload 明确标记为 `public` 或 `everyone` 的活动才会发布；未知隐私状态一律拒绝。
- 每次最多为 12 条尚未处理路线的跑步活动补充 detail/GPX 路线，后续定时调用继续补齐。
- GPS 坐标和 GPX 字节只短暂存在内存；数据库仅保存归一化的 SVG `M/L` path 和 viewBox。
- 成功同步会对取消公开、删除或移出 12 个月窗口的活动做对账。重复执行为幂等 upsert。
- 认证错误把状态标记为 `reauth_required`；网络、限流或存储错误标记为 `degraded`。旧快照仍可读取并在超过 6 小时后显示 stale。

## 重新认证

token 被撤销或失效时，先停用 timer：

```bash
cd /opt/applog/current/workers/garmin-sync
sudo ./manage-timer disable
```

然后复用 bootstrap 更新 worker、unit 并重新 provision，但跳过自动同步：

```bash
sudo ./bootstrap \
  --user applog \
  --python /usr/bin/python3.12 \
  --venv /opt/applog/venvs/garmin-sync \
  --skip-sync
```

认证完成后手动启动一次 service；验证成功再恢复 timer：

```bash
sudo systemctl start applog-garmin-sync.service
sudo ./manage-timer enable
```

## 加密密钥轮换

1. 停用 timer。
2. 生成新密钥并更新当前生效的高优先级配置文件。
3. 使用同一新密钥重新运行 provision，覆盖数据库中的旧加密信封。
4. 手动启动 service 并检查公开 API。
5. 验证通过后恢复 timer。

不要只修改环境变量后直接启动 worker：旧 token 无法用新密钥解密，会导致同步失败。

## 停用与回滚

停止后续同步但保留现有快照：

```bash
cd /opt/applog/current/workers/garmin-sync
sudo ./manage-timer disable
```

这不会删除历史快照，公开 API 仍可返回最近一次成功数据，并在超过 6 小时后标记 stale。若需要立即隐藏页面，只移除 Landing 的 `LandingGarminStats` 组合即可；无需删除表或凭据。

如需移除服务器调度配置，可在 timer 已停止后删除两个 unit 文件并执行 `sudo systemctl daemon-reload`；是否删除数据库快照和加密凭据应作为单独的数据清理操作处理。

日志只允许出现累计数、发布数、路线成功数、耗时、request id 和错误类别。禁止记录 token、邮箱、Garmin 原始响应、坐标、GPX/FIT 内容或请求头。
