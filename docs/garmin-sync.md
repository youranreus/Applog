# Garmin 运动快照运维

Garmin 接入由独立 Python worker 完成。生产环境默认在 Linux 服务器上通过 systemd oneshot service 和 timer 运行，不依赖阿里云 Function Compute。worker 是唯一会解密 Garmin token、访问非官方 Garmin Connect 接口的组件；NestJS 和公开页面只读取 MySQL 中的白名单快照。

## 运行条件

- Linux 服务器，推荐带 systemd 的发行版
- Python 3.12
- 能访问 Garmin Connect HTTPS 接口和项目 MySQL
- 与 NestJS 使用同一 MySQL 数据库
- 专用的低权限系统用户，例如 `applog`

worker 默认从 NestJS 的 `packages/backend` 目录加载环境配置文件。MySQL 优先读取 `GARMIN_MYSQL_*`，缺失时回退到 NestJS/FC 使用的 `MYSQL_*`。在当前生效的高优先级文件（例如 `.env.development.local`）中追加：

- `GARMIN_MYSQL_SERVER`、`GARMIN_MYSQL_PORT`、`GARMIN_MYSQL_USER`、`GARMIN_MYSQL_PASSWORD`、`GARMIN_MYSQL_DATABASE`
- `APP_SECRET_ENCRYPTION_KEY`：32 字节随机主密钥的严格 Base64 文本；worker
  通过 HKDF-SHA256 为 token 与私有数据派生互相隔离的子密钥
- `GARMIN_IS_CN`：Garmin 中国区账号设为 `true`，国际区设为 `false`
- `GARMIN_TIME_ZONE`：Garmin 健康自然日使用的 IANA 时区，当前部署建议 `Asia/Shanghai`
- `GARMIN_REQUEST_BUDGET`：单轮 Garmin 请求上限，默认 `80`

首次生成主密钥时运行 `openssl rand -base64 32`，将结果直接交给部署 Secret
管理；不要使用口令、UUID，也不要把值写入仓库。
- `GARMIN_HEALTH_EMPTY_DAY_LIMIT`：连续多少个无任何观测值的历史自然日后判定已到上游边界，默认 `30`
- `GARMIN_PRIVATE_ARCHIVE_ENABLED`、`GARMIN_HEALTH_BACKFILL_ENABLED`、`GARMIN_MAP_COVERS_ENABLED`：三个独立回滚开关
- `TENCENT_MAP_KEY`：地图封面启用时需要；使用只启用
  WebService 的服务端 Key，不得提交到 Git 或输出到日志
- `GARMIN_MAP_RENDER_TIMEOUT_SECONDS`：单次静态图请求总超时，默认 `8`

地图底图统一由腾讯静态图 API 在线生成。
普通户外活动使用统一 Web Mercator camera，在 480×480 封面保留 16px
目标安全区；足球仅在拿到真实 GPS 采样时在同一底图上生成密度热力图。椭圆
机等活动没有轨迹但 Garmin weather payload 有合法位置时显示单点标记，内部
provenance 标记为 `weather`；完全没有坐标时显示明确的无地图封面。

## 腾讯静态底图（轻量部署）

地图链路不需要自建 renderer、地图数据卷、地图镜像、字体目录或 release manifest。Key
作为 worker 环境文件中的 secret 交给既有 `bootstrap` / `manage-timer` 自动化，
部署命令和服务注册方式不变：

```ini
GARMIN_MAP_COVERS_ENABLED=true
TENCENT_MAP_KEY=REPLACE_WITH_SERVER_SIDE_KEY
GARMIN_MAP_RENDER_TIMEOUT_SECONDS=8
```

为 Key 只开启 WebService，并配置控制台支持的最窄服务端安全限制。worker 只向
静态图接口发送转换后的中心点、整数 zoom、`480*480`、`scale=2` 和
`maptype=roadmap`；完整轨迹、marker、活动 ID 不会发给腾讯。路线、起终点、
单点和足球热力层仍由 worker 本地绘制。

腾讯模式只保证中国大陆文档支持范围。境外点会在发起 HTTP 请求前返回
`region_missing` 并遵循现有封面降级保护。响应中的 `X-LIMIT` 额度信息只作为
进程内遥测读取，不记录 Key、完整 URL 或坐标。生产启用前必须在当前账户确认
静态图额度、商用资格和生成图片的持久化/展示条款。

腾讯请求失败时沿用本地无底图降级封面，且不会用失败结果覆盖已有成功封面。

## 通用部署配置

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
GARMIN_MYSQL_SERVER=127.0.0.1
GARMIN_MYSQL_PORT=3306
GARMIN_MYSQL_USER=applog_garmin
GARMIN_MYSQL_PASSWORD=replace-with-database-password
GARMIN_MYSQL_DATABASE=applog
APP_SECRET_ENCRYPTION_KEY=replace-with-base64-master-key
GARMIN_IS_CN=true
GARMIN_TIME_ZONE=Asia/Shanghai
GARMIN_REQUEST_BUDGET=80
GARMIN_HEALTH_EMPTY_DAY_LIMIT=30
GARMIN_PRIVATE_ARCHIVE_ENABLED=true
GARMIN_HEALTH_BACKFILL_ENABLED=true
GARMIN_MAP_COVERS_ENABLED=true
TENCENT_MAP_KEY=replace-with-server-side-key
GARMIN_MAP_RENDER_TIMEOUT_SECONDS=8
```

## 首次部署

1. 先备份 Garmin 表、在 staging 检查 `synchronize` diff，再部署 NestJS schema。确认公开快照表之外已创建 private activity/payload/detail、daily health、stream state 与 cover media 表，再启用新 worker。

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

## 从旧 Garmin 密钥迁移

该操作必须在维护窗口完成。先禁用 Garmin timer/FC trigger 并确认没有 worker
进程，再备份数据库。部署包含 `keyVersion` 字段的新 NestJS schema，但不要启动新
worker。迁移期间同时提供新主密钥和两把旧密钥；旧密钥仅供维护命令读取：

```ini
APP_SECRET_ENCRYPTION_KEY=replace-with-new-base64-master-key
GARMIN_TOKEN_ENCRYPTION_KEY=legacy-token-key
GARMIN_DATA_ENCRYPTION_KEY=legacy-data-key
```

按顺序执行：

```bash
cd workers/garmin-sync
.venv/bin/manage-encryption preflight --dry-run
.venv/bin/manage-encryption migrate --backup-id release_20260820 --dry-run
.venv/bin/manage-encryption migrate --backup-id release_20260820
.venv/bin/manage-encryption verify --backup-id release_20260820
```

`backup-id` 仅允许字母、数字和下划线。迁移会创建两张不可覆盖的完整备份表，
逐条用旧密钥认证解密、用派生子密钥和新随机 nonce 重加密，并在提交后全量回读。
非敏感进度写入 `app_secret_encryption_migration` ledger，记录阶段和行数，不记录
密钥或密文内容。同一 `backup-id` 仅在备份与源数据逐字段一致时才允许安全重试。
任何失败均返回非零且不得重新开启 timer。需要恢复时执行：

```bash
.venv/bin/manage-encryption rollback --backup-id release_20260820
```

验证新 worker 手工同步成功后才恢复 timer。观察期结束且另有数据库备份后，人工
删除备份表和旧环境变量；维护命令不会自动删除它们。日常运行与 `verify` 只需要
`APP_SECRET_ENCRYPTION_KEY`，`OIDC_SESSION_SECRET` 保持独立。

## 日常检查

```bash
cd /opt/applog/current/workers/garmin-sync
./manage-timer status
sudo journalctl -u applog-garmin-sync.service --since today
```

- worker 每次优先刷新近期公开投影和今天/昨天健康数据，再推进一个有界历史页。
- 只有 Garmin payload 明确标记为 `public` 或 `everyone` 的活动才会发布；未知隐私状态一律拒绝。
- 活动所有可用端点和 FIT、全天健康 payload 使用独立数据密钥压缩加密；精确坐标和逐点数据不会进入公开快照。
- 公开候选最多六条生成 WebP 封面；renderer 故障时保留已有高质量地图，首次生成使用带错误分类的本地降级图，不使数据同步失败。
- 私有活动历史不再因年龄删除；取消公开或上游删除只撤销公开投影。重复执行通过 source id、自然日、payload hash 和 stream cursor 幂等。
- 健康回填不使用固定年数截断，而在连续 `GARMIN_HEALTH_EMPTY_DAY_LIMIT` 个自然日无观测值后确认上游边界；归一化摘要保留真实 `0`，local/GMT 边界只在 Garmin 实际返回时间戳时写入。
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
