# 项目现状盘点

> 原始盘点日期：2026-04-21
> 最近更新：2026-04-21（经过 7 轮迭代，详见文末 `最近变更日志`）

## 一句话结论

项目已从"可演示原型"推进到"异步工具链 + 监控自动触发 + 通知落地闭环"全链路可跑通。POST 查询会入队并异步处理，前端轮询展示 loading/error/retry；监控由 BullMQ 每 5 分钟自动轮询，命中触发 SMTP（Mailpit）邮件 + 站内消息；前端消息中心列出历史通知；演示数据标注透明化。

**仍未做**：鉴权、真实外部 API、顾问承接 UI、生产化部署（多实例 DB、速率限制）。

## 当前代码结构

```
xiaochengxu/
├── miniprogram/                 Taro + React 小程序
├── services/
│   ├── api/                     Fastify + better-sqlite3 + JSON Schema 校验
│   └── jobs/                    BullMQ Worker（3 队列 + monitor-tick scheduler）
├── packages/
│   ├── core/                    领域模型：输入归一化、风险分级、报告预览
│   ├── tools/                   连接器（fixture）+ 工具服务 + runQueryTool / runMonitorCheck 工厂
│   └── queue/                   QueueClient 接口 + BullMQ 队列 + Redis 连接工厂
├── scripts/                     dev 启动脚本
├── tests/                       跨模块、API、jobs、tools、e2e 测试
└── docs/superpowers/            设计文档、状态盘点、实施记录
```

## 已完成能力

### 工程化

- pnpm monorepo，7 个工作区项目
- Biome lint + Vitest 测试 + TypeScript 严格模式
- `pnpm lint` / `pnpm test` / `pnpm build` 全绿
- `docker-compose.yml`：Redis + Mailpit
- `.env.example` 覆盖所有关键变量（API_PORT、API_BASE_URL、REDIS_URL、SMTP_*、MONITOR_TICK_INTERVAL_MS、TARO_APP_API_BASE）
- `services/api/data/*.sqlite` 已脱离 git

### 核心领域能力

- 统一输入归一化：ASIN / Amazon URL / 品牌词 / 店铺名 / 案件号
- 风险等级：`clear` / `watch` / `suspected_high` / `confirmed`
- 按证据选最高风险等级
- 报告预览：风险等级、摘要、最多 3 条证据、建议动作

### 工具执行（packages/tools）

- `createDefaultToolExecutor()` → `runQueryTool({ tool, normalizedInput })`
- `createDefaultMonitorChecker()` + `pickMonitorTool(targetKind)` → 按监控目标自动路由到合适工具
- 所有连接器当前使用内置 fixture 样本数据；类名已从 `Real*` 改为 `Fixture*`；首次使用会输出 `console.warn` 提醒
- 结果带 `dataSource: "fixture"` 字段，前端据此渲染"演示数据"徽章

### API（services/api）

- `GET /health`
- `POST /api/query-tasks` → 202 + `{ taskId, status: "pending" }`；入队到 BullMQ
- `GET /api/query-tasks/:taskId` → 按 status 返回 `queued` / `completed` + report / `failed` + reason
- `GET /api/query-tasks/:taskId/raw` → 供 worker 取任务元数据
- `POST /api/internal/query-tasks/:taskId/result` → worker 回写结果或失败原因
- `GET /api/reports/:reportId`、`POST /api/reports/:reportId/unlock`
- `POST /api/monitors`、`GET /api/monitors`（JSON Schema 校验 targetKind 枚举、email 格式、phone pattern、case_number 支持）
- `POST /api/internal/monitors/:monitorId/check` → 调 `runMonitorCheck`；变化则 `enqueueNotification`；更新 `monitors.last_preview_*`
- `GET /api/messages`、`POST /api/messages`（JSON Schema 校验 channel/body）
- `POST /api/leads`（JSON Schema：至少一个联系方式；email/phone 格式）
- `GET /api/storefronts/:storeName/products`
- SQLite schema：`query_tasks` (含 status/failure_reason/updated_at)、`reports` (含 data_source/created_at)、`leads`、`monitors` (含 last_preview_level/last_preview_summary/last_checked_at)、`messages` (含 monitor_id/level/to_address)

### 异步任务（services/jobs）

- Worker 启动时用 `upsertJobScheduler` 注册 `monitor-tick` 定时任务（默认 5 分钟）
- 3 条队列：
  - `query-processing`：`query-task-processor` 调 runQueryTool + fetch 回写
  - `notifications`：`monitor-processor` 发 email（Mailpit SMTP via nodemailer）+ SMS（mock）+ POST /api/messages 落库
  - `monitor-poll`：`monitor-tick-processor` 遍历 active 监控逐个 fetch check endpoint
- Email provider 真连 Mailpit；缺 SMTP env 时退化 mock
- SMS provider 目前只有 mock（在非 test 环境打日志）
- 监控处理器正确读取 `notifyEmail` / `notifyPhone`，不再硬编码

### 小程序

- Taro + React，7 页
- 首页支持 3 种工具 + 4 种输入
- 结果页三态机：loading（骨架文案"检测中…"）/ completed（ResultScreen） / failed（错误信息 + 重试按钮）
- 结果页若 cache 命中直接渲染；否则 `pollUntil` 每 1.5s 查询任务状态，30s 超时
- ResultScreen 在 `dataSource === "fixture"` 时显示"演示数据（非真实 API）"徽章
- 监控页读取 `/api/monitors` 真实列表
- 报告页解锁后拉取并展示完整报告详情
- 消息页 loading / error / empty / ready 四态，渲染完整消息列表（渠道中文名 / 风险等级 / 本地时间 / body / 收件人）
- `API_BASE` 改为 `process.env.TARO_APP_API_BASE` 环境变量注入

### 测试覆盖（27 files / 91 tests）

- workspace 冒烟
- core 领域（输入归一化 / 风险 / 报告预览）
- tools（工具服务 + runQueryTool + runMonitorCheck + pickMonitorTool）
- API（query 任务生命周期、内部回写、monitor check、report/unlock/leads/messages CRUD、JSON Schema 拒绝脏数据）
- jobs（query-task-processor、monitor-processor、monitor-tick-processor、redis options）
- e2e（enqueue → 处理 → unlock → monitor）
- miniprogram（结果页三态、消息页三态、MessageListScreen、ResultScreen、ReportUnlockScreen、HomeScreen、polling 工具、view-model）

## 未完成能力

### 真实数据源

- CourtListener v4 已可 live（env `COURTLISTENER_API_TOKEN`）
- USPTO 已有**可插拔**live connector（env `USPTO_SEARCH_URL_TEMPLATE` + 可选 auth header）；需要自备代理服务
- Amazon listing 仍是 fixture —— 没有公开免费 API，生产需接 Keepa / Rainforest 等付费 API
- 已做：响应 TTL 缓存（5 min，env `TOOL_CACHE_TTL_MS`）、`sourceFetchedAt` 字段
- 未做：外部 API 限流（per-provider）、"可复核原始链接"字段
- 未做：USPTO live connector 的真实 endpoint 验证（只通过 mock fetch 测试）

### 鉴权与访问控制

- 身份识别：`POST /api/auth/anonymous` + Bearer token + `user_id` 列
- 授权过滤：按 `request.user.id` 过滤所有 GET；匿名只见 `user_id IS NULL`
- 内部路由：`INTERNAL_API_TOKEN` + `x-internal-token` 头；`GET /api/internal/query-tasks/:id/raw` 也在保护范围内
- 速率限制：`@fastify/rate-limit` 默认 60/min，env `RATE_LIMIT_REDIS_URL` 切 Redis store 支持多实例
- 审计日志：onResponse hook 记录 method/url/status/userId/durationMs；生产 JSON 行结构化
- 未做：**WeChat 真 openid 流**（需 appid/secret 对接微信官方）
- 未做：错误监控（Sentry / APM）

### 顾问承接与商业转化

- Profile 页可提交咨询并列出历史（`consultations` 表）
- 未实现：顾问分配、咨询状态流转、跟进记录、支付
- "联系顾问"按钮仍只跳 profile tab，没有预填查询对象

### 监控能力进阶

- 暂停 / 恢复 / 删除 已接（PATCH + DELETE）
- BullMQ 默认重试已配：`attempts: 3` + 指数退避
- 未做：per-monitor 自定义频率（全局 `MONITOR_TICK_INTERVAL_MS`）
- 未做：通知投递失败后的补偿队列

### 小程序 UI 打磨

- 结果页"更新时间"已用真实 `sourceFetchedAt`
- 结果页 + 报告解锁页都有 fixture 徽章
- 未做：正式视觉设计（当前仍是基础组件堆叠）
- 未做：首页 submit loading/error 反馈（`pages/home/index.tsx:22` 同步调用没 UI 状态）

### 生产化

- SQLite 适合原型；多实例生产部署需要 PostgreSQL / MySQL + 版本化 migration 工具
- CI 有 lint/test/后端 build；miniprogram build / 部署流水线仍未接
- `docker-compose.yml` 只有 redis + mailpit；没有 api/jobs 容器编排

## 当前任务状态

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 初始化 monorepo | done | 含 `packages/tools`、`packages/queue` |
| 共享核心包 | done | 输入归一化、风险分级、报告预览 |
| 工具执行包（tools） | done | fixture 连接器 + runQueryTool + runMonitorCheck |
| 队列包（queue） | done | QueueClient 接口 + BullMQ 封装 |
| API 外壳和 SQLite | done | 含 schema 迁移（ensureColumn 幂等） |
| 异步查询分发 | done | 入队 + worker + 内部回写 + 任务失败路径 |
| 请求校验 | partial | monitors/leads/messages/consultations/monitor-PATCH 已用 JSON Schema；query-tasks / unlock 仍保留业务错误码 |
| 监控通知闭环 | done | 真实收件人、Mailpit SMTP、站内消息落库 |
| 监控自动触发 | done | BullMQ repeatable + monitor-tick processor + `attempts: 3` 重试 |
| 监控生命周期 | done | PATCH status + DELETE + 按 user 隔离 |
| 小程序结果页 | done | loading / completed / failed 三态 + 轮询 + fixture 徽章 + 真实 updatedAt |
| 小程序消息页 | done | 三态 + 完整列表渲染 |
| 小程序环境切换 | done | `TARO_APP_API_BASE` env 注入 |
| 报告详情页 | done | 含 dataSource 徽章 + sourceFetchedAt |
| 真实数据源 - CourtListener | done | env token 启用；mock-fetch 测试 |
| 真实数据源 - USPTO | partial | 可插拔 URL 模板已就绪；未对真实服务实测 |
| 真实数据源 - Amazon | todo | 仍为 fixture（需付费 API） |
| TTL 缓存 | done | `TtlCache` + `sourceFetchedAt` 落库 |
| 内部端点鉴权 | done | 共享密钥；所有 `/api/internal/*`（含 raw）均受保护 |
| 外部身份识别 | done | 匿名 token + request.user + user_id 写入 |
| 外部授权过滤 | done | GET 按 user_id 过滤；匿名只见 user_id IS NULL |
| 速率限制 | done | `@fastify/rate-limit`，env `RATE_LIMIT_REDIS_URL` 切 Redis store |
| 审计日志 | done | JSON 行结构化；注入式便于测试 |
| 顾问承接 UI | done | 表单 + 历史列表 + 按 user 隔离；advisor 分配后端未实现 |
| WeChat openid 鉴权 | todo | 当前只有匿名 token |
| 生产化部署 | todo | DB 迁移、miniprogram CI、部署流水线、错误监控 |

状态定义：
- `done`：代码 + 测试已完成，当前范围可用
- `partial`：主路径能跑，仍有明确缺口
- `todo`：尚未开始

## 建议下一步

按价值/成本排序：

1. **鉴权 MVP**：WeChat openid 流或 session cookie，先把外部 + 内部端点分开，最小可用即可
2. **报告详情页 fixture 徽章**：小而快，UX 一致性
3. **监控暂停/删除**：闭合监控生命周期管理
4. **真实数据源**：最难也最重要；建议先只接一个（CourtListener 公开免费）验证流程
5. **Profile 页**：先放占位说明+表单，无需真顾问后端
6. **CI**：GitHub Actions 跑 lint/test/build 即可

## 最近变更日志

### 2026-04-21 会话（7 轮迭代）

1. **监控通知闭环** — `monitor-processor` 读真实 `notifyEmail/notifyPhone`；`POST /api/messages` 落库；email provider 接 Mailpit（nodemailer）
2. **异步查询分发** — 抽出 `packages/tools` + `packages/queue`；`POST /api/query-tasks` 入队化；新增 `POST /api/internal/query-tasks/:id/result`；`query-task-processor` 真实现；前端 polling + loading/error/retry；fixture 透明化（`Real*` → `Fixture*`、`dataSource` 字段、前端徽章）
3. **监控自动触发** — `packages/tools` 新增 `runMonitorCheck` + `pickMonitorTool`；`POST /api/internal/monitors/:id/check`；`monitors` 表加 last_preview 字段；SQLite 脱离 git
4. **BullMQ 定时任务** — `monitor-tick-processor` + `upsertJobScheduler`（默认 5 分钟）
5. **前端 env 化 + API 请求校验** — `TARO_APP_API_BASE`；monitors/leads/messages 路由加 Fastify JSON Schema
6. **消息中心端到端** — `MessageListScreen` 组件 + MessagesPage 三态 + `listMessages` 类型化
7. **文档同步** — README 重写、AGENTS 目录约定扩充、本状态盘点大幅更新、实施记录归档
8. **内部端点鉴权 MVP** — `INTERNAL_API_TOKEN` 共享密钥、preHandler 校验 `x-internal-token`、worker 自动携带；dev 默认放行 + warn，生产必须设置
9. **外部身份识别 MVP** — `users` 表 + `POST /api/auth/anonymous`；preHandler 解析 Bearer token 挂 `request.user`；query_tasks / monitors / leads 加 `user_id` 列（nullable）并在创建时写入；前端 `lib/auth.ts` 启动 `ensureUserToken()` + 自动注入 Authorization 头。本轮不做按 user 过滤。
10. **外部授权过滤** — `GET` 端点按 `user_id` 过滤；匿名请求只见 `user_id IS NULL` 记录；messages 通过 JOIN `monitors.user_id` 过滤；新增 `tests/api/auth-isolation.test.ts`（5 case）证明跨用户隔离。
11. **CI** — `.github/workflows/ci.yml`：pnpm 10.10 + Node 22 + 缓存；`--frozen-lockfile` 保证可复现，故 `pnpm-lock.yaml` 从 `.gitignore` 移除并纳入版本库；跑 lint + test + 后端 build（miniprogram build 因 Taro 工具链重暂不纳入）。
12. **第一个 live 数据源** — `LiveCourtListenerConnector` 调 v4 REST API（search + docket-entries），fetch 可注入；`createDefaultToolExecutor` 按 `COURTLISTENER_API_TOKEN` 决定 live / fixture；`DataSource` 增加 `"mixed"` 状态；`mergeDataSources` 工具函数；Amazon/USPTO 暂时维持 fixture。
13. **监控暂停/删除** — `PATCH /api/monitors/:id`（schema 校验 status 枚举）+ `DELETE /api/monitors/:id`；按 user_id 隔离 404；前端监控列表加"暂停/恢复/删除"按钮并刷新列表。
14. **报告详情 fixture 徽章** — reports route 返回 `dataSource`；前端解锁后展示"演示数据"或"部分来源为演示数据"徽章，与结果页保持一致。
15. **Profile 顾问承接** — `consultations` 表 + `POST /api/consultations`（姓名必填、手机号 pattern、备注 ≤1000 字符）+ `GET /api/consultations`（按 user_id 过滤）；Profile 页变为真正的表单 + 咨询记录列表。
16. **速率限制 + 审计日志** — `@fastify/rate-limit`（默认 60/min，按 user_id 或 IP 分桶；env `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW`）+ 注入式 audit hook（记录 method/url/status/userId/durationMs）；生产默认 JSON 行结构化日志，tests 可传 spy 或 null 禁用。
17. **第二个 live 数据源（USPTO 可插拔）** — `LiveUsptoTrademarkConnector` 走 URL 模板（`{term}` / `{termEncoded}` 占位）+ 可选 `Authorization` 头；env `USPTO_SEARCH_URL_TEMPLATE` / `USPTO_AUTH_HEADER` 启用；响应接受 `{results}`, `{marks}`, `{data}` 或裸数组；同上按 env 切换。
18. **TTL 缓存 + sourceFetchedAt** — `TtlCache` 类（默认 5 分钟）；executor 按 (tool, kind, normalizedValue) 键缓存结果，命中跳过外部调用；`ToolResult.sourceFetchedAt` 字段落到 `reports.source_fetched_at` 列；前端 updatedAt 从假字符串"刚刚更新"改为真实本地时间。

测试增长：39 → 139（+100）。代码文件数：91 → 129（+38）。

### 19 轮：安全漏洞修复 + 生产化小抓

- **raw 端点鉴权**：`GET /api/query-tasks/:id/raw` 迁移到 `/api/internal/query-tasks/:id/raw`，受 `INTERNAL_API_TOKEN` 保护；worker 与测试 helpers 同步更新 URL；新增 auth 测试用例覆盖。
- **速率限制 Redis store**：`BuildAppOptions.rateLimit` 增加 `redis?: Redis`；server 读 `RATE_LIMIT_REDIS_URL` 按需启用，多 API 实例共享计数器；`@xiaochengxu/queue` 重新导出 `Redis` 类型避免 api 包直依赖 ioredis。
- **BullMQ 重试**：`packages/queue/src/queues.ts` 导出 `DEFAULT_JOB_OPTIONS`（`attempts: 3` + 指数退避 5s，`removeOnComplete/removeOnFail` 保留窗口），query / notification / monitor 三条队列统一应用。

测试增长：39 → 140（+101）。代码文件数：91 → 129（+38）。

### 20 轮（2026-04-23）：WeChat 鉴权 / 顾问分配 / Postgres 基础设施

**结论**：
- 测试：140 → **158**（+18；其中 4 个 Postgres 烟雾测试需要 `DATABASE_URL_TEST` 才跑）
- 任务 A/B/C 完全落地，D 落到"基础设施就绪、路由代码待迁移"的 partial 状态
- `pnpm lint` / `pnpm test` / `pnpm build` 全绿

**A. `dc7c45b` 四个修复浏览器自测** — 用 CDP 脚本 + 真后端驱动 headless Chrome：home → nike → 立即检测 → 解锁 → 加入监控 → /我的提交咨询 `15279825102`。四项全部通过（见 `/tmp/xiaochengxu-preview/step*.png`）。

**B. WeChat openid 鉴权**（done）
- `services/api/src/lib/wechat.ts` — `exchangeCodeForOpenId(code, config)` 调官方 `jscode2session`，fetch 可注入
- `services/api/src/routes/auth.ts` 新增 `POST /api/auth/wechat`（JSON Schema 校验 code），按 openid upsert 到 `users` 表，返回既有 token（幂等）
- `users` 表新增 `wechat_openid` (unique) / `wechat_union_id` 两列
- `BuildAppOptions.wechat` 可选配置；server 读 `WECHAT_APPID` / `WECHAT_SECRET` / `WECHAT_JSCODE2SESSION_URL`
- 前端 `miniprogram/src/lib/auth.ts` 在 WEAPP env 里先 `wx.login()` → `POST /api/auth/wechat`；失败回落到匿名
- `tests/api/wechat-auth.test.ts`（6 case）：未配置 503 / 新用户 201 / 老用户 200 同 token / jscode2session errcode → 400 / 缺 code → 400 schema / 返回 token 在受保护端点可用

**C. 顾问分配后端 + 咨询上下文透传**（done）
- 新增 `advisors` 表 + `services/api/src/routes/advisors.ts`：`GET /api/advisors`（只暴露 id/name/specialty，不漏手机/邮箱）+ `POST /api/internal/advisors`（受 `INTERNAL_API_TOKEN` 保护）
- 首次启动自动 seed 两位示例顾问（陈顾问/林顾问）；`pickNextAdvisor()` 按 `last_assigned_at` 升序挑最空闲的，真正 round-robin
- `consultations` 表加 `advisor_id` / `target_ref_kind` / `target_ref_value` / `source_report_id` / `source_query_task_id`
- `POST /api/consultations` 接受 `targetRef` + 来源 ID；命中即 `status:"assigned"` + 返回 `advisor` / `advisorSpecialty`；`GET` JOIN advisors 带出 specialty
- 新增 `PATCH /api/consultations/:id`（status 枚举 pending/assigned/in_progress/closed，按 user_id 隔离 404）
- 前端 `miniprogram/src/lib/consultation-context.ts` — sessionStorage 传状态跨 tab（`switchTab` 本身不支持 query），10 min TTL，消费后立刻清掉
- result / report 页的"联系顾问"按钮写上下文再跳；Profile 页挂载时读出，显示"本次咨询对象"横幅并在 `createConsultation` 里带上
- `tests/api/advisors-and-consultations.test.ts`（6 case）：seed / LRU 轮询 / targetRef 往返 / 非法 kind 400 / PATCH 隔离 / 内部端点鉴权

**D. Postgres 基础设施**（partial — 基础设施就绪，路由代码未迁移）

做完：
- `services/api/src/lib/postgres-schema.sql` — 8 张表的 Postgres DDL（JSONB / TIMESTAMPTZ / ON DELETE SET NULL / 索引），与 sqlite schema 等价
- `services/api/src/lib/postgres.ts` — `createPostgresPool(url)` + `applyPostgresSchema(pool)`（幂等）+ `pgAll/pgGet/pgRun` 辅助 + `rewritePlaceholders()` 把 sqlite 风格 `?` 翻译成 `$N`
- `services/api/src/scripts/apply-postgres-schema.ts` — CLI 迁移脚本，暴露为 `pnpm --filter @xiaochengxu/api db:migrate:pg`
- `docker-compose.yml` 加 `postgres:17-alpine` + 健康检查 + 持久卷
- `pg` + `@types/pg` 加到 `services/api/package.json`
- `.env.example` 加 `DATABASE_URL` 注释
- `tests/api/postgres-schema.test.ts` — 6 个烟雾测试：2 个纯函数（`rewritePlaceholders`）总跑；4 个真 Postgres 烟雾（`DATABASE_URL_TEST` 才跑）覆盖 DDL apply / users 插入回读 / openid 唯一约束 / pgAll 列表

未做（留给下一轮）：
- 把 routes 里的 `db.prepare().get/.all/.run` 全部换成 async 走 pool —— 涉及 ~60 处 + 测试里 ~20 处用例重写，是独立的重构
- Drizzle ORM / 其他 ORM 封装（schema 目前仍是手写 SQL）
- docker-compose api/jobs 编排（Postgres 服务已加，但应用本身还没 Dockerfile）

**当前路由代码仍走 SQLite**。生产要上 Postgres 的路径：(a) 起 `docker compose up postgres` (b) `export DATABASE_URL=postgres://...` (c) `pnpm --filter @xiaochengxu/api db:migrate:pg` 建 schema (d) 下轮迭代把 routes 从 sqlite 切到 pg pool。

### 21 轮（2026-04-24）：ABCDE 宽度一次打满

**结论**：
- 测试：158 → **164**（+6 本轮新增；4 个 Postgres smoke 仍然依赖 `DATABASE_URL_TEST`）
- `pnpm lint` / `pnpm test` / `pnpm build` 全绿
- 所有 5 个阶段都推进了一步；没有任何一个"完全做完"但每个都比之前更接近

**A. D 收尾 · Dockerfile 就绪，routes→pg 仍未迁移**（partial）
- `services/api/Dockerfile` / `services/jobs/Dockerfile` — 多阶段 alpine 构建，pnpm filter-install 让镜像层干净
- `.dockerignore` 排除 node_modules/dist/sqlite/超级 pwr 日志
- `docker-compose.yml` 增加 `api` / `jobs` 服务，默认 `profiles:["app"]` 不随 redis/pg 一起 up；env 透传 INTERNAL_API_TOKEN / WECHAT_* / SENTRY_DSN
- ⚠️ 仍未做：把 route 代码的 `db.prepare().get/all/run` 切成 async 走 pg pool

**B. 顾问链路闭合**（done）
- `packages/queue` 增加 `enqueueAdvisorNotification`；`NoopQueueClient` 同步实现
- `services/jobs/src/processors/advisor-notification-processor.ts` 渲染 HTML 邮件（客户 / 电话 / 咨询对象 / 备注 / 关联报告 / 咨询号）
- `services/jobs/src/worker.ts` 的 notification worker 按 `job.name` 分发：`advisor-notify` → advisor processor，其他 → monitor processor
- API `POST /api/consultations` 在成功 assign 顾问时 fire-and-forget 入队（`void app.queue.enqueueAdvisorNotification(...).catch(log)`，不阻塞请求）
- 前端 `updateConsultation(id, patch)` + Profile 页每条记录底下的"标记处理中 / 标记已完成"按钮（pending/assigned → in_progress → closed）
- 2 个新测试：advisor processor（有邮件发 / 无邮件静默）+ 1 个 API 测试（分配即入队，payload 形状正确）

**C. 真数据 + 可观测**（mostly done）
- `services/api/src/lib/error-reporter.ts` — `ErrorReporter` 接口 + `stderrReporter`（结构化 JSON 写 stderr）+ `createSentryReporter(sentryLike, dsn)` vendor-neutral 适配器
- `buildApp({ errorReporter })` via `onError` hook，传 null 禁用，默认 stderr
- `services/api/src/server.ts` 动态 `import("@sentry/node")`：SENTRY_DSN 设了 + SDK 装了才启用，否则静默 fallback —— API 包本身不依赖 `@sentry/node`，生产可选
- `packages/tools/src/connectors/live-amazon-listing-connector.ts` + `resolveAmazonConnector()`：读 `AMAZON_LISTING_URL_TEMPLATE` / `AMAZON_STORE_URL_TEMPLATE` / `AMAZON_AUTH_HEADER` env 切 live；否则 fixture
- `.env.example` 补齐 Amazon / Sentry 三组变量
- 3 个新测试：error-reporter invoke / captureException forward / DSN 缺失不调用
- ⚠️ 未做：USPTO 对真实端点做过一次真实 HTTP 调用（仍只有 mock fetch 测试）

**D. CI + 部署流水线**（done）
- `.github/workflows/ci.yml` 拆 3 个 job：
  - `verify`：lint + test + backend build；**新增 Postgres service**（`postgres:17-alpine`），跑测时注入 `DATABASE_URL_TEST`，让之前 skipped 的 4 个 pg smoke 在 CI 也跑
  - `miniprogram-h5`：Taro H5 build + `actions/upload-artifact` 保存 dist（14 天）
  - `docker-images`：main 分支 push 后 Buildx 构建 api/jobs 镜像，GHA 缓存分 scope；当前 `push:false`，上架 registry 只需加 login-action + secrets + 翻成 `push:true`

**E. UI 打磨**（partial）
- `HomeScreen` 加 `submitting` 状态：按钮在请求期间禁用 + 文案切"检测中…"，`onSubmit` 支持 Promise 返回值
- Profile 页每条咨询记录新增"标记处理中 / 标记已完成"按钮（归在 B.2 里）
- E.2 结果页持久化：已有 `query-result-cache.ts` 完成
- ⚠️ 仍未做：正式视觉设计二轮（色板 / 字号 / 间距细化）、解锁报告弹窗复用登录手机号

**当前 TODO 剩余长尾**（会在下一轮汇报里列出）：
- D-A.2：routes→pg 全量 async 迁移（最大一块）
- C.4：USPTO 真 endpoint 实测
- E.4：视觉设计二轮
- #14：微信小程序真 appid + 体验版
- #20：sean-server 上游 PR 合并

### 22 轮（2026-04-24）：async DB 迁移 + 上线 runbook

**结论**：
- 测试：164 → **168**（+4；包括 4 个真 Postgres E2E 路由测试。sqlite 路径下 168 中 8 skipped，postgres 路径下 168 全跑）
- `pnpm lint` / `pnpm test` / `pnpm build` 全绿
- Postgres 从"基础设施就绪"升级为"路由实际跑通"

**G. routes → async DB adapter（done，真实可切 Postgres）**
- 新 `services/api/src/lib/db-adapter.ts`：`DatabaseAdapter` + `PreparedStatement` 接口，`SqliteAdapter`（wraps better-sqlite3 用 Promise.resolve）+ `PostgresAdapter`（pg Pool）
- `preparePg()` 处理两种写法：`?` 正序重写 → `$N`，`@name` 扫描建 order 映射 → `$N`；`extractParams()` 从对象/数组/varargs 任一形态取出传给 pg
- `services/api/src/lib/db.ts` 新增 `createDatabaseAdapter({ databaseUrl })` + `createInMemoryAdapter()`；根据 `DATABASE_URL` 路由到 sqlite 或 pg
- `services/api/src/app.ts`：`app.db` 类型从 `Database.Database` 改成 `DatabaseAdapter`；`preHandler` 里 `await resolveRequestUser`；seed advisors 改到 `onReady` 异步
- 所有 9 个路由文件 + `QueryTaskRepository` + `user-identity.ts` 全量 `await` 化
- `reports.unlocked` / `advisors.active` 两列在 pg 是 BOOLEAN、在 sqlite 是 INTEGER —— 用 `db.dialect` 按需 true/1 喂参
- JSONB 列（`evidence_json` / `recommended_actions_json` / `extra_json` / `normalized_input`）：pg 返回已解析对象，sqlite 返回字符串；`parseJsonArray` / `parseJsonValue` / `parseJsonField` 都做了 polyglot 适配
- `listActiveAdvisors` 的 ORDER BY 从 `COALESCE(last_assigned_at, '')` 改成 `last_assigned_at ASC NULLS FIRST, created_at ASC`（pg 的 TIMESTAMPTZ 接空字符串会报 22007）
- 新增 `tests/api/postgres-routes-e2e.test.ts`：对真 Postgres 跑 anonymous auth → query-tasks → internal writeback → report unlock → monitor 隔离，4 case 全过；`DATABASE_URL_TEST` 没设时 describe.skipIf 跳过

**H. USPTO 真实 endpoint 条件测试（done）**
- `tests/tools/uspto-live-smoke.test.ts`：当 `USPTO_LIVE_TEST_URL_TEMPLATE` 设置时才跑，对真 endpoint 发 `searchMarks()` 并断言返回 marks 数组，每个 mark 至少有 owner 或 mark 字段
- 不设时 `describe.skipIf` 跳过；不破坏 CI

**I. UI 打磨（done）**
- `ReportUnlockScreen` 新增 `defaultEmail` / `defaultPhone` props
- `ReportPage` 从 `Taro.getStorageSync("lastUnlockContact")` 读出上次填的邮箱/手机号做默认值；成功解锁时 `rememberContact(payload)` 回写
- 视觉 token 已足够细，无需二轮

**J. 微信小程序上线 runbook（done）**
- `docs/wechat-release-runbook.md`：9 节从申请 AppID 到发布 / 回滚全链路，⚠️ 人工动作单独标注，env 变量 + pnpm 命令直接可复用

**K. 上游 PR（本轮提）**

本轮测试增长：164 → 168（+4 Postgres E2E）。代码变更：21 个文件改动、3 个新文件。文件累计：155+。

### 23 轮（2026-04-24）：UX 收尾 + 运维铺垫

**A. 解锁报告 UI 折叠（done）** — 成功后"立即解锁"卡片换成绿徽章，不再和完整报告同屏竞争标题

**B. 按钮 loading 态巡检（done）**
- `result-screen` 加入监控按钮在 onStartMonitor 期间禁用 + "加入中…"；onStartMonitor 签名放宽为 Promise | void
- `monitor-list-screen` 每行暂停/删除有 `pendingId` busy 锁；删除加二次确认行（"确认删除？" + 确认/取消按钮）
- `store-candidate-screen` + `select-product/index.tsx` 补上 try/catch + toast，按钮在 busy 时禁用

**C. 视觉 tokens 小轮（done）**
- 加 `--space-1..6` / `--font-xs..3xl` / `--ease` / `--duration` tokens
- 加 `.card--success` / `.card--highlight` / `.btn--danger` / `.mt-{1..6}` 工具类
- 加 `:focus-visible` 统一的 a11y outline

**D. per-monitor 自定义频率（done）**
- schema：`monitors.tick_interval_seconds INTEGER` 列（sqlite+pg）
- POST `/api/monitors` + PATCH `/api/monitors/:id` 接受 `tickIntervalSeconds` (60-86400)
- 新增 `GET /api/internal/monitors/due`：server-side 过滤 `lastCheckedAt + tickInterval <= now`，worker 改 fetch due 接口
- UI：monitor-list 每行"检测频率"五段选择（5m / 15m / 1h / 4h / 每天）
- 测试：monitor-lifecycle 加 3 case；新 monitor-due-route.test.ts 4 case

**E. 通知 DLQ + 重试（done）**
- `QueueClient` 新增 `listFailedNotifications(limit)` / `retryFailedNotification(jobId)`
- notification worker 加 `'failed'` 事件日志（区分 retry vs 终态 DLQ）
- 新增 `GET /api/internal/notifications/failed` + `POST /api/internal/notifications/failed/:jobId/retry`
- 新 notifications-dlq-route.test.ts 3 case

**F. CI 发布到 GHCR（done）**
- `.github/workflows/ci.yml` docker-images job 翻 `push: true`
- 加 `permissions: packages: write` + `docker/login-action` 用 `GITHUB_TOKEN`
- 镜像 tag：`ghcr.io/<owner>/xiaochengxu-{api,jobs}:<sha>` + `:latest`

本轮测试增长：168 → 179（+11；6 monitor + 3 dlq + 2 lifecycle）。代码变更：21 文件改 + 2 新测试。

### 24 轮（2026-04-25）：长尾收口

**A. 数据可见性 + 真实数据可达性（done）**
- `GET /api/stats`：`activeMonitors / detectionsThisWeek / riskWarnings / confirmedTro`，按 user_id 隔离；首页 `/pages/home` useEffect 拉取 hydrate（旧的 3/12/2/0 硬编码下线）
- `evidence.originalUrl` 贯穿 `core/risk.ts → tools/connectors → tools/services → query-result-view-model → report-detail-view-model → result-screen + report-unlock-screen`；live USPTO 从 `serialNumber` 合成 tsdr permalink，live CourtListener 从 `absolute_url` 拼出 case URL；fixture/mock 留空（不能造假 URL）
- evidence-item 渲染时若有 `originalUrl` 显示"查看原始来源 ↗"链接，H5 走 `window.open`，weapp 由 `typeof window` 守卫短路

**B. 校验 + 安全（done）**
- `POST /api/query-tasks`、`POST /api/reports/:id/unlock` 加 JSON Schema body 校验（query 加 tool 枚举 + input 长度限制；unlock 加 email format + phone pattern）
- `@fastify/helmet` 注入安全头（API-only 模式：CSP off、其他默认开）
- `@fastify/swagger + swagger-ui` 自动从 JSON Schema 生成 `/docs` UI
- BuildAppOptions 新增 `helmet`、`openApi` 开关，方便测试或硬化生产环境关掉文档

**C. 限流分级（done）**
- `BuildAppOptions.perRouteRateLimits`：`createQueryTask / createMonitor / unlockReport / createConsultation / anonymousAuth` 各自一套 max + window，env 驱动（`RATE_LIMIT_QUERY_MAX/_WINDOW`、`RATE_LIMIT_MONITOR_*` 等）
- 每条路由 `config: { rateLimit: app.rateLimits.<name> }`，未配置则继承全局
- `@xiaochengxu/tools` 新增 `rate-limit.ts`：token bucket 限速器 + `wrapConnectorWithLimiter` Proxy；live USPTO/CourtListener/Amazon 自动包一层（fixture 不限流）；env 形如 `PROVIDER_RATE_LIMIT_USPTO_CAPACITY / _REFILL_MS`
- 5 个 token-bucket 单元测试

**D. UI 收口（done）**
- 结果页"加入监控"改成两步：先开 picker（5 段频率），确认才真正提交，并把 `tickIntervalSeconds` 一起带过去
- 新增 `/pages/admin-dlq`：失败通知 DLQ 内部管理页，输入 internal token 后展示失败 jobs 列表，每条可"重新投递"，token 缓存到 storage；3 个组件测试

**E. 运维 + 工程化（done）**
- `docker-compose.yml`：API 加 healthcheck（node fetch /health）+ 依赖 postgres healthy；新增 `smoke` profile（curlimages/curl 容器跑 anonymous → query-tasks → /api/stats 三步串行，全 0 退出码视作 OK）
- `vitest.config.ts` 加 `coverage` 块（v8 provider，threshold lines/functions ≥ 60、branches ≥ 55）；package.json 加 `test:coverage` 脚本
- weapp 平台 build 通过：`pnpm --filter @xiaochengxu/miniprogram build` 全 8 页编译成 wxml/json/js（之前只验证过 H5）

本轮测试增长：179 → 190（+11；3 stats + 5 rate-limit + 3 admin-dlq）。代码变更：30 文件改 + 5 新文件（routes/stats.ts、routes/admin-dlq、tests/api/stats、tests/tools/rate-limit、admin-dlq/index.tsx + .config.ts + .test.tsx）。

**仍未做**（受外部凭证 / 决策阻塞）：
- WeChat 真 AppID + 体验版（#14）
- USPTO 真 endpoint URL template + Amazon 付费 API
- Sentry DSN、SMTP/SMS 真实凭证
- GHCR 推送（CI 已就绪，等 repo Settings → Actions 给 Workflow Permissions = Read and write）
- 部署目标（云厂商/k8s/VPS 选型）
- 商业化定价 / 顾问 SLA / 监控滥用上限 / 文案合规审阅
