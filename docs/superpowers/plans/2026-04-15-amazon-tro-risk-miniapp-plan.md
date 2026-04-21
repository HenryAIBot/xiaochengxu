# 亚马逊美国站侵权与 TRO 风险小程序实施计划

> 面向执行者：本计划记录 V1 的实现拆分。代码路径、命令、包名、API 字段和风险级别枚举保留英文，其余说明使用中文。

**目标：** 构建 V1 微信小程序和后端，让 Amazon 美国站卖家可以完成侵权体检、TRO 预警、案件进展追踪，并支持报告解锁、持续监控和通知。

**架构：** 使用 `pnpm` monorepo。`miniprogram/` 中的 `Taro + React` 小程序调用 `services/api/` 中的 `Fastify` 接口。`packages/core/` 放归一化、风险分级和报告模型。`services/jobs/` 负责异步任务、监控轮询和通知投递。数据先使用 `SQLite`，通过仓储接口隔离，后续可以替换为更完整的数据库。

**技术栈：** TypeScript、pnpm workspace、Taro 4、React 18、Fastify 5、better-sqlite3、BullMQ、Redis、Biome、Vitest、Testing Library。

**当前状态：** 任务 1、2、3、7 已完成；任务 4、5、6、8 处于 `partial`。任务 6 的报告详情、解锁状态更新、报告来源归因、小程序正式报告详情渲染、结果页创建监控和监控页真实列表已完成，但监控通知落库和顾问承接仍未完整打通。任务 5 的 BullMQ worker 启动配置已修复，但真实调度、监控轮询和通知落库仍未完整打通。详细状态、未完成闭环和优化顺序见 `docs/superpowers/specs/2026-04-21-project-status.md`。

---

## 文件结构

- `package.json`：根脚本和共享开发依赖。
- `pnpm-workspace.yaml`：workspace 成员。
- `tsconfig.base.json`：共享 TypeScript 配置。
- `biome.json`：格式化和 lint 配置。
- `vitest.config.ts`：测试发现配置。
- `docker-compose.yml`：本地 Redis 和 Mailpit。
- `packages/core/`：输入归一化、风险分级、报告模型和建议动作。
- `services/api/`：Fastify 应用、SQLite 仓储、工具服务和 HTTP 路由。
- `services/jobs/`：队列、监控处理器和通知适配器。
- `miniprogram/`：Taro 小程序页面、组件和 API 客户端。
- `tests/fixtures/`：确定性的测试样本。
- `tests/`：跨模块测试和端到端冒烟流程。
- `scripts/`：本地启动辅助脚本。

## 任务 1：初始化 monorepo

**涉及文件：**

- 新增：`package.json`
- 新增：`pnpm-workspace.yaml`
- 新增：`tsconfig.base.json`
- 新增：`biome.json`
- 新增：`vitest.config.ts`
- 新增：`docker-compose.yml`
- 新增：`tests/workspace/root-smoke.test.ts`

**实施要点：**

- 先写 workspace 冒烟测试，确认 `miniprogram`、`services/*`、`packages/*` 都被声明。
- 补齐根脚本：`lint`、`test`、`build`。
- 补齐本地 Redis 和 Mailpit。
- 运行 `pnpm install` 和 workspace 冒烟测试。

## 任务 2：构建共享核心包

**涉及文件：**

- 新增：`packages/core/package.json`
- 新增：`packages/core/tsconfig.json`
- 新增：`packages/core/src/input.ts`
- 新增：`packages/core/src/risk.ts`
- 新增：`packages/core/src/report.ts`
- 新增：`packages/core/src/index.ts`
- 新增：`tests/core/domain.test.ts`

**实施要点：**

- 归一化输入：ASIN、Amazon 链接、品牌词、店铺名、案件号。
- 定义统一风险级别：`clear`、`watch`、`suspected_high`、`confirmed`。
- 根据证据选择最高风险级别。
- 生成报告摘要、关键证据和建议动作。

## 任务 3：增加 API 外壳和 SQLite 持久化

**涉及文件：**

- 新增：`services/api/package.json`
- 新增：`services/api/tsconfig.json`
- 新增：`services/api/src/app.ts`
- 新增：`services/api/src/server.ts`
- 新增：`services/api/src/lib/db.ts`
- 新增：`services/api/src/repositories/query-task-repository.ts`
- 新增：`services/api/src/routes/query-tasks.ts`
- 新增：`tests/api/query-task-route.test.ts`

**实施要点：**

- 提供 `/health`。
- 提供 `/api/query-tasks`，接收检测工具和输入内容。
- 归一化输入并记录查询任务。
- 创建报告预览记录。
- 查询完成后返回任务 ID、报告 ID、风险等级、摘要、证据和建议动作。

## 任务 4：实现数据源连接器和工具服务

**涉及文件：**

- 新增：`services/api/src/connectors/*`
- 新增：`services/api/src/services/tro-alert-service.ts`
- 新增：`services/api/src/services/infringement-check-service.ts`
- 新增：`services/api/src/services/case-progress-service.ts`
- 新增：`services/api/src/services/storefront-candidate-service.ts`
- 新增：`tests/api/tool-services.test.ts`

**实施要点：**

- TRO 预警从法院案件数据中识别临时限制令信号。
- 侵权体检按输入类型处理：ASIN 先查商品页再提取品牌，品牌词直接查商标库。
- 案件进展从 docket 节点生成时间线和摘要。
- 店铺名输入先返回代表商品候选，让用户选择具体 ASIN。
- 所有给用户看的摘要和证据说明必须是中文。

## 任务 5：增加队列、监控和通知处理

**涉及文件：**

- 新增：`services/jobs/package.json`
- 新增：`services/jobs/src/queues.ts`
- 新增：`services/jobs/src/worker.ts`
- 新增：`services/jobs/src/processors/query-task-processor.ts`
- 新增：`services/jobs/src/processors/monitor-processor.ts`
- 新增：`services/jobs/src/providers/email-provider.ts`
- 新增：`services/jobs/src/providers/sms-provider.ts`
- 新增：`tests/jobs/processors.test.ts`

**实施要点：**

- 查询任务和通知任务分离。
- 监控命中非 `clear` 风险时触发邮件、短信和站内消息。
- 通知标题、短信正文和站内消息使用中文。

## 任务 6：扩展报告、线索、监控和消息接口

**涉及文件：**

- 新增：`services/api/src/routes/reports.ts`
- 新增：`services/api/src/routes/leads.ts`
- 新增：`services/api/src/routes/monitors.ts`
- 新增：`services/api/src/routes/messages.ts`
- 新增：`services/api/src/routes/storefronts.ts`
- 修改：`services/api/src/lib/db.ts`
- 修改：`services/api/src/app.ts`
- 新增：`tests/api/report-and-monitor-routes.test.ts`

**实施要点：**

- 报告解锁时记录邮箱或手机号，并更新报告解锁状态。`done`
- 报告解锁 lead 记录报告、任务、工具和输入来源归因。`done`
- 提供 `GET /api/reports/:reportId` 读取报告详情、查询来源、证据、建议动作和解锁状态。`done`
- 小程序正式报告页在解锁后拉取并展示完整报告详情。`done`
- 结果页 `加入监控` 基于当前查询对象创建监控记录。`done`
- 监控任务记录监控对象、联系方式和状态，并提供列表读取接口。`done`
- 消息接口返回系统消息。
- 店铺商品候选接口返回代表 ASIN 和标题。

## 任务 7：构建小程序页面骨架

**涉及文件：**

- 新增：`miniprogram/package.json`
- 新增：`miniprogram/src/app.tsx`
- 新增：`miniprogram/src/app.config.ts`
- 新增：`miniprogram/src/components/home-screen.tsx`
- 新增：`miniprogram/src/components/result-screen.tsx`
- 新增：`miniprogram/src/components/store-candidate-screen.tsx`
- 新增：`miniprogram/src/pages/*`
- 新增：`miniprogram/src/lib/api.ts`
- 新增：`miniprogram/src/test/setup.ts`

**实施要点：**

- 首页支持品牌词、店铺名、ASIN 输入。
- 三个工具入口为：侵权体检、TRO 预警、案件进展。
- 店铺名进入商品候选页。
- 结果页展示风险摘要、关键证据、建议动作、报告解锁、加入监控和联系顾问。
- 页面上所有用户可见内容使用中文。

## 任务 8：完成结果页、报告页和完整链路

**涉及文件：**

- 新增：`miniprogram/src/lib/query-result-view-model.ts`
- 新增：`miniprogram/src/lib/query-result-cache.ts`
- 修改：`miniprogram/src/pages/home/index.tsx`
- 修改：`miniprogram/src/pages/select-product/index.tsx`
- 修改：`miniprogram/src/pages/result/index.tsx`
- 修改：`miniprogram/src/pages/report/index.tsx`
- 新增：`tests/e2e/query-flow.test.ts`

**实施要点：**

- 首页提交查询后缓存真实查询结果。
- 结果页按任务 ID 读取缓存，不展示固定示例。
- 报告页使用真实 `reportId` 解锁。
- 结果页视图模型把风险等级、数据源和证据说明转为中文。

## 验证

每次改动后运行：

```bash
pnpm lint
pnpm test
pnpm build
```

预期：

- Biome 无错误。
- Vitest 全部通过。
- 各 workspace 构建完成。
