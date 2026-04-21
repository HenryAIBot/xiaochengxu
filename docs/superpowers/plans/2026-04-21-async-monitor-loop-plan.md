# 2026-04-21 异步查询 + 监控闭环 实施记录

> 本文档记录一次工作会话内的 7 轮连续交付。每轮都以 `pnpm lint` / `pnpm test` 全绿作为收敛点。

## 背景

会话开始时的状态：
- 查询全部同步执行，`query-task-processor` 是 no-op
- 监控可以创建，但没人触发；就算触发，处理器也把通知发给硬编码的 `ops@example.com`
- 前端结果页只读 localStorage，缓存丢失就显示"未找到检测结果"
- `Real*Connector` 命名让人误以为在调真实 API，实际全是内置样本

## 交付顺序

### 第 1 轮：监控通知闭环

- `monitor-processor` 重构为接受 `notifyEmail` / `notifyPhone`，按渠道条件性发送；渠道均缺时落 system 消息
- `POST /api/messages` 新增；`messages` 表加 `monitor_id` / `level` / `to_address` 列
- `email-provider` 接 nodemailer → Mailpit（缺 env 退化 mock）
- `sms-provider` 非 test 环境打日志；未实现 provider 抛错而非静默成功
- 测试：2 → 5 个 case（单渠道 / 双渠道 / 无渠道 / clear 跳过）

### 第 2 轮：异步查询分发

- 新包 `packages/tools`：迁入 `services/api/src/{connectors,services}`；`real-*` 重命名为 `fixture-*`；类名 `Real*` → `Fixture*`；导出 `createDefaultToolExecutor()` 统一工具入口；首次使用 `console.warn`
- 新包 `packages/queue`：迁入 queue 定义；`QueueClient` 接口 + `createQueueClient()` 工厂 + `createRedisConnection()`
- API 层：`buildApp` 接受 `queue` 注入；`POST /api/query-tasks` 返回 `202 { taskId, status: "pending" }`；新增 `GET /api/query-tasks/:id/raw`、`POST /api/internal/query-tasks/:id/result`
- `query-task-processor` 端口化：`loadTask` / `runTool` / `postResult` / `postFailure`
- worker：fetch 实现端口
- SQLite：`query_tasks.failure_reason` / `updated_at`、`reports.data_source` / `created_at`
- 前端：`pollUntil` + `PollTimeoutError`；结果页三态机；`ResultScreen` 渲染 "演示数据" 徽章；`createQueryTask` 返回 `{ taskId, status }`
- 测试：新增 processor / internal-result / run-query-tool / polling；改写 query-task-route / e2e / result page；从 39 → 60

### 第 3 轮：SQLite 去 git + 监控触发链路

- `.gitignore` 新增 `services/api/data/*.sqlite*`；`git rm --cached` 已追踪的 sqlite
- `monitors` 表加 `last_preview_level` / `last_preview_summary` / `last_checked_at`
- `packages/tools` 新增 `pickMonitorTool()` + `createDefaultMonitorChecker()` —— 按 targetKind 路由到合适工具
- `POST /api/internal/monitors/:id/check`：跳过非 active → 调用 runMonitorCheck → level 变化且非 clear → `enqueueNotification`（带真实 email/phone）
- 测试：5 + 6 个 case

### 第 4 轮：BullMQ 定时触发

- `monitor-tick-processor`：拉 `/api/monitors` → 逐个 POST check endpoint；失败不中断
- worker 启动时 `upsertJobScheduler("monitor-tick", { every: MONITOR_TICK_INTERVAL_MS })`
- `.env.example` 加 `MONITOR_TICK_INTERVAL_MS=300000`
- 测试：3 个 case

### 第 5 轮：前端 env 化 + API 请求校验

- `miniprogram/src/lib/api.ts` 改读 `process.env.TARO_APP_API_BASE`
- Fastify JSON Schema 覆盖 `POST /api/monitors`（targetKind 枚举、email/phone 格式、case_number 支持）、`POST /api/leads`（`anyOf: [email, phone]`）、`POST /api/messages`（channel 枚举）
- 测试：新增 `validation.test.ts` 11 个 case

### 第 6 轮：消息中心端到端

- `listMessages` 返回 `MessageItem[]` 而非 unknown
- `MessageListScreen` 组件：渠道中文名 + 风险等级 + 本地时间 + body + 收件人 + 空态
- `MessagesPage` 三态：loading / ready / failed 带重试
- 测试：组件 3 个 case + 页 3 个 case

### 第 7 轮：文档同步

- 重写 `README.md`：架构图 / 包与服务表 / 本地开发 / env 变量 / 手动验证 curl / 验证命令
- 更新 `AGENTS.md` 目录约定（加 `packages/tools` / `packages/queue`）
- 重写 `docs/superpowers/specs/2026-04-21-project-status.md` 反映本轮交付
- 本文档归档

## 最终架构

```
监控创建 (POST /api/monitors, 带 notifyEmail/notifyPhone)
   ↓
BullMQ scheduler (jobs worker 启动时注册，每 5 分钟)
   ↓
monitor-tick-processor
   ↓ (每个 active 监控)
POST /api/internal/monitors/:id/check
   ↓ (level 变化且非 clear)
queue.enqueueNotification
   ↓
notification worker → monitor-processor
   ├─ sendEmail (Mailpit SMTP)
   ├─ sendSms (mock)
   └─ saveMessage (POST /api/messages)
   ↓
SQLite messages 表
   ↓
MessagesPage → MessageListScreen
```

## 验证

最终测试数量：**27 files / 91 tests**（从 39 增加 +52）。`pnpm lint` / `pnpm test` / `pnpm build` 全绿。

## 未做 / 刻意延后

- **鉴权**：外部 + 内部端点均无 user 身份。建议下一轮用 WeChat openid 或 session cookie 做 MVP。
- **真实外部 API**：所有连接器仍是 fixture；接真 API 是最难的一步，属于独立工程。
- **顾问承接 UI**：Profile 页仍是占位一句话；需要产品决策才能动。
- **监控生命周期**：暂停 / 恢复 / 删除 API + UI 都没做。
- **报告详情页 fixture 徽章**：结果页有，报告详情页没有，一致性小缺口。

## 关键文件索引

- `packages/tools/src/index.ts` — 工具工厂
- `services/api/src/routes/internal.ts` — 内部回写 + monitor check
- `services/api/src/routes/query-tasks.ts` — 入队化
- `services/jobs/src/worker.ts` — 3 队列 + scheduler
- `services/jobs/src/processors/{query-task,monitor,monitor-tick}-processor.ts`
- `miniprogram/src/pages/{result,messages}/index.tsx` — 三态机
- `miniprogram/src/components/{result,message-list}-screen.tsx`
- `miniprogram/src/lib/polling.ts`
