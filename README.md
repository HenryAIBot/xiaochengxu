# 侵权风险监控小程序

面向 Amazon 美国站卖家的侵权风险与 TRO 监控小程序原型。主流程：品牌词 / ASIN / 店铺名 / 案件号 → 异步工具查询 → 风险预览 → 解锁完整报告 → 加入持续监控 → 命中后邮件/短信/站内消息。

> 当前是 **可演示原型**，不是生产版本。连接器仍使用 fixture（演示数据），结果中会附带 `dataSource: "fixture"` 标识。真实外部 API、鉴权和多实例部署仍未做。

详细盘点见：`docs/superpowers/specs/2026-04-21-project-status.md`

## 架构

```
miniprogram (Taro + React)
    │  HTTP
    ▼
services/api (Fastify + better-sqlite3)
    │        ▲
    │ BullMQ │ fetch (回写 result、落 messages、触发 monitor check)
    ▼        │
services/jobs (BullMQ Worker)
    │
    ├─ query-task-processor    调 packages/tools 执行查询
    ├─ monitor-processor       发邮件/短信 + 写站内消息
    └─ monitor-tick-processor  定时遍历 active 监控并触发 check
```

### 包与服务

| 位置 | 职责 |
| --- | --- |
| `miniprogram/` | Taro + React 小程序；结果页轮询任务状态、展示 loading/error/retry、演示数据徽章 |
| `services/api/` | Fastify API：查询任务、报告解锁、监控 CRUD、线索、消息、内部回写端点 |
| `services/jobs/` | BullMQ Worker：消费 3 条队列（query / notification / monitor），启动时注册 `monitor-tick` 定时任务 |
| `packages/core/` | 领域模型：输入归一化、风险分级、报告预览 |
| `packages/tools/` | 连接器 + 工具服务 + `createDefaultToolExecutor` / `createDefaultMonitorChecker` 工厂 |
| `packages/queue/` | BullMQ 队列定义、`QueueClient` 接口与实现、Redis 连接工厂 |
| `tests/` | 跨模块与端到端测试（API、jobs、tools、e2e） |

## 本地开发

本项目统一使用 Node 22。API 依赖 `better-sqlite3`，原生绑定必须和当前 Node ABI 匹配。

```bash
nvm use
pnpm install
cp .env.example .env            # 按需调整
./scripts/dev-up.sh             # 起 Redis + Mailpit
pnpm --filter @xiaochengxu/api dev         # 终端 A
pnpm --filter @xiaochengxu/jobs dev        # 终端 B（会自动注册 monitor-tick 定时任务）
pnpm --filter @xiaochengxu/miniprogram dev # 终端 C
```

- Mailpit Web UI：`http://127.0.0.1:8025`
- API：`http://127.0.0.1:3000/health`

## 关键环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `API_PORT` | `3000` | API 监听端口 |
| `API_BASE_URL` | `http://127.0.0.1:3000` | jobs worker 回调 API 的 base URL |
| `INTERNAL_API_TOKEN` | *(空)* | API 与 jobs worker 之间 `/api/internal/*` 的共享密钥；留空 = dev 放行（启动会 warn）；生产必须设置 |
| `REDIS_URL` | `redis://127.0.0.1:6379` | BullMQ Redis 连接 |
| `SMTP_HOST` / `SMTP_PORT` | `127.0.0.1` / `1025` | 邮件发送目标（Mailpit）；缺省时 email provider 退化为 mock |
| `SMTP_FROM` | `alerts@xiaochengxu.local` | 发件人 |
| `SMS_PROVIDER` | `mock` | 短信 provider，`mock` 之外目前未实现 |
| `MONITOR_TICK_INTERVAL_MS` | `300000` | jobs worker 触发 monitor 检查的间隔（毫秒） |
| `COURTLISTENER_API_TOKEN` | *(空)* | 设置后 `tro_alert` 与 `case_progress` 切到真实 CourtListener v4 API；空则继续用 fixture。免费申请：https://www.courtlistener.com/help/api/rest/ |
| `COURTLISTENER_BASE_URL` | `https://www.courtlistener.com` | 重定向到自托管或测试环境时覆盖 |
| `USPTO_SEARCH_PROVIDER` | *(空)* | 设为 `markbase` 后，商标检索走 Markbase 的真实 USPTO 商标索引；设置 `USPTO_SEARCH_URL_TEMPLATE` 时优先走自建 USPTO proxy |
| `MARKBASE_API_BASE_URL` | `https://api.markbase.co` | Markbase API endpoint |
| `MARKBASE_STATUS_CODES` | `700,800` | Markbase 查询的 USPTO 状态码；默认只取 live registered / renewed registrations |
| `RAINFOREST_API_KEY` | *(空)* | 设置后 Amazon ASIN / 店铺候选走 Rainforest live 数据；空则继续用 fixture |
| `RAINFOREST_API_BASE_URL` | `https://api.rainforestapi.com/request` | Rainforest API endpoint |
| `RAINFOREST_AMAZON_DOMAIN` | `amazon.com` | Rainforest 查询的 Amazon marketplace |
| `TARO_APP_API_BASE` | `http://127.0.0.1:3000` | 小程序构建时注入的 API 地址 |

API / jobs 启动时会自动向上查找并加载项目根目录 `.env`；`.env` 已被 git 忽略。`.env.example` 只保留字段清单和非敏感默认值。

## 端到端手动验证

```bash
curl -sX POST http://127.0.0.1:3000/api/query-tasks \
  -H 'content-type: application/json' \
  -d '{"tool":"tro_alert","input":"nike"}'
# -> 202 {"taskId":"...","status":"pending","normalizedInput":{...}}

# 稍候，再查：
curl -s http://127.0.0.1:3000/api/query-tasks/<taskId>
# -> {"status":"completed","reportId":"...","result":{"level":"suspected_high",...,"dataSource":"fixture"}}

# 创建监控 → 手动触发检查 → Mailpit 能收到邮件：
MONITOR_ID=$(curl -sX POST http://127.0.0.1:3000/api/monitors \
  -H 'content-type: application/json' \
  -d '{"targetKind":"brand","targetValue":"nike","notifyEmail":"seller@example.com"}' \
  | jq -r .id)
curl -sX POST http://127.0.0.1:3000/api/internal/monitors/$MONITOR_ID/check
# -> {"triggered":true,"level":"suspected_high",...}

# 查看落库的站内消息：
curl -s http://127.0.0.1:3000/api/messages

# 匿名身份：小程序启动会自动调；手动示例：
TOKEN=$(curl -sX POST http://127.0.0.1:3000/api/auth/anonymous | jq -r .token)
# 带 Authorization 的请求会在创建记录时写入 user_id：
curl -sX POST http://127.0.0.1:3000/api/query-tasks \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"tro_alert","input":"nike"}'
```

## 验证

- `pnpm lint`（Biome）
- `pnpm test`（Vitest，目前 30 files / 107 tests）
- `pnpm build`（全部 packages/services TS 编译）

## CI

`.github/workflows/ci.yml` 在 `push to main` 与 `pull_request` 时运行 `lint + test + 后端 build`（miniprogram build 暂不纳入，Taro 工具链体量过大，放在后续单独作业）。缓存 pnpm store 加速安装；使用 `--frozen-lockfile` 保证可复现，因此 `pnpm-lock.yaml` **必须提交**。
