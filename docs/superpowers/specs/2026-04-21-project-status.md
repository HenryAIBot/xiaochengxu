# 项目现状盘点

> 盘点日期：2026-04-21  
> 目标：记录当前代码结构、已完成能力、未完成能力和优化建议，作为后续任务状态更新的基准。

## 一句话结论

当前项目已经完成 V1 骨架和主要查询闭环：小程序可以从首页发起检测，API 可以同步生成查询结果和报告预览，结果页可以展示风险分诊并进入报告解锁。

但当前状态仍是 `可演示原型`，不是生产可用版本。主要差距在于真实数据源、异步任务、监控通知、报告详情、顾问承接、鉴权和部署配置。

## 当前代码结构

- `miniprogram/`：Taro + React 微信小程序。包含首页、商品选择页、结果页、报告解锁页、监控页、消息页、我的页。
- `services/api/`：Fastify API。包含查询任务、报告解锁、监控创建、消息列表、线索、店铺商品候选接口。
- `services/jobs/`：BullMQ jobs。包含查询任务处理器、监控处理器、邮件和短信 provider 占位实现。
- `packages/core/`：共享领域模型。包含输入归一化、风险分级、报告预览构建。
- `tests/`：跨模块测试、API 测试、jobs 测试、端到端查询流程测试和 fixtures。
- `docs/superpowers/specs/`：产品设计、关键设计文档和当前状态文档。
- `docs/superpowers/plans/`：实施计划和任务拆分。
- `scripts/`：本地开发辅助脚本。
- `demo/`：独立 HTML demo，不属于核心生产链路。

## 已完成能力

### 工作空间与工程化

- 已建立 `pnpm` monorepo。
- 已拆分 `miniprogram`、`services/api`、`services/jobs`、`packages/core`。
- 根脚本已有：
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- 已配置 Biome、Vitest、TypeScript、Taro、Fastify、SQLite。
- 已提供本地开发说明和 `docker-compose.yml`。

### 核心领域能力

- 支持统一输入归一化：
  - ASIN
  - Amazon 商品链接
  - 品牌词
  - 店铺名
  - 案件号
- 已定义统一风险等级：
  - `clear`
  - `watch`
  - `suspected_high`
  - `confirmed`
- 已实现按证据选择最高风险等级。
- 已实现报告预览模型：
  - 风险等级
  - 摘要
  - 最多 3 条证据
  - 建议动作

### API 能力

- `GET /health` 可用。
- `POST /api/query-tasks` 可同步完成查询并返回结果。
- `GET /api/query-tasks/:taskId` 可读取任务和报告记录。
- `GET /api/reports/:reportId` 可读取报告详情、查询来源、证据、建议动作和解锁状态。
- `POST /api/reports/:reportId/unlock` 可记录联系方式、更新报告解锁状态，并写入来源归因。
- `POST /api/monitors` 可创建监控记录。
- `GET /api/monitors` 可读取监控列表。
- `GET /api/messages` 可读取站内消息。
- `POST /api/leads` 可创建线索。
- `GET /api/storefronts/:storeName/products` 可返回店铺代表商品候选。
- SQLite schema 已覆盖：
  - `query_tasks`
  - `reports`
  - `leads`，包含报告、任务、工具和输入来源归因
  - `monitors`
  - `messages`

### 查询服务能力

- `TRO 预警`：根据法院案件搜索结果生成 TRO/案件风险信号。
- `侵权体检`：
  - ASIN 输入会提取 listing 品牌，再查商标信号。
  - 品牌词输入会直接查商标信号。
- `案件进展`：根据 docket entries 生成中文案件时间线和风险摘要。
- `店铺名输入`：已有代表商品候选服务和前端选择页。

### 小程序能力

- 首页支持输入 `品牌词 / 店铺名 / ASIN`。
- 首页支持选择：
  - 侵权体检
  - TRO 预警
  - 案件进展
- 侵权体检 + 店铺名输入会进入商品候选页。
- 查询结果会缓存到本地，并按任务 ID 进入结果页。
- 结果页已展示：
  - 工具名
  - 风险等级
  - 摘要
  - 更新时间
  - 关键证据
  - 建议动作
  - 解锁完整报告
  - 加入监控
  - 联系顾问
- 报告页支持邮箱或手机号任选其一解锁。
- 结果页点击 `加入监控` 已会基于当前查询对象调用 `POST /api/monitors` 创建监控记录，并跳转监控页。
- 监控页已读取 `/api/monitors` 展示真实监控列表。
- 小程序正式报告页已在解锁后拉取 `GET /api/reports/:reportId`，展示查询对象、检测类型、风险等级、完整证据和处理清单。
- `demo/index.html` 已支持一次查询后保存真实 `reportId`，解锁后直接拉取并展示完整报告内容。
- 消息页可以读取消息接口。
- 监控页和我的页已有基础占位。

### 测试覆盖

- workspace 冒烟测试。
- core 输入归一化、风险分级、报告预览测试。
- API 查询任务、报告解锁、监控、店铺候选测试。
- 查询服务测试。
- jobs 监控通知处理器测试。
- 小程序首页、结果页、报告解锁页、结果视图模型测试。
- 端到端 API 查询、解锁、监控流程测试。

## 未完成能力

### 真实数据源

- 当前 `Real*Connector` 实际是内置样本数据和规则匹配，不是实时调用 Amazon、USPTO、CourtListener 或 PACER。
- 未完成真实外部 API 凭证、限流、失败重试、缓存、数据保鲜策略。
- 未完成对数据来源时间、可复核链接、证据出处的完整展示。

### 异步任务与队列

- API 当前同步执行查询，没有真正把查询任务投递到 `queryQueue`。
- `runQueryTaskProcessor` 目前只返回 `processed`，没有执行真实查询或落库。
- `monitorQueue` 已声明但未形成轮询链路。
- jobs worker 没有和 API SQLite 仓储打通。

### 持续监控与通知

- 小程序结果页的 `加入监控` 已创建真实监控记录。
- 监控页已读取真实监控列表。
- 监控处理器使用硬编码收件人和手机号，没有读取用户创建监控时的联系方式。
- 站内消息保存目前在 worker 中是占位函数，没有写入 API 数据库。
- 没有监控频率、去重、风险升级判断、通知失败重试。

### 报告详情与商业转化

- 报告解锁接口已记录 lead、更新 `reports.unlocked` 字段，并带报告、任务、工具和输入来源归因。
- `fullReportUrl` 指向的 `GET /api/reports/:reportId` 已实现，可返回查询来源、报告预览、证据、建议动作和解锁状态。
- 完整报告详情目前复用查询时落库的 preview、证据、建议动作和 extra 数据，还没有独立的深度报告章节模型。
- 静态 demo 和小程序正式报告页均已能在解锁后展示完整报告。
- 未实现支付、顾问分配、咨询预约或聊天承接。
- 独立 `POST /api/leads` 创建的线索仍没有业务来源归因。

### 小程序体验

- UI 仍是基础组件堆叠，缺少正式样式、加载态、错误态、空态和重试入口。
- API 地址硬编码为 `http://127.0.0.1:3000`，没有区分开发、测试、生产环境。
- 查询失败、接口超时、结果缓存失效时的用户反馈不足。
- 结果页的更新时间当前固定为 `刚刚更新`，不是后端真实时间。
- 案件进展输入没有针对案件号和品牌词的差异化确认。
- 联系顾问只是跳转我的页，没有真实表单或服务流。

### 安全与生产化

- API 没有鉴权、用户身份、访问控制。
- 接口请求体校验较弱，部分接口允许空联系方式或无效数据。
- 没有速率限制、审计日志、错误监控。
- SQLite 适合当前原型，不适合多实例生产部署。
- `services/api/data/query-tasks.sqlite` 是本地运行数据，不应进入版本库。

## 建议优化顺序

### P0：先补齐可信查询闭环

1. 明确 `Real*Connector` 命名和真实程度：如果仍是样本数据，改名为 `Fixture*Connector` 或 `Seeded*Connector`。
2. 查询结果增加 `createdAt`、`sourceLinks`、`sourceFetchedAt`，让结果可解释、可复核。
3. 为 `/api/query-tasks` 增加严格 schema 校验，避免无效工具、空输入、非法联系方式进入系统。
4. 小程序补齐查询 loading、失败提示和重试。

用户影响：用户能判断结果是否可信，失败时知道下一步，而不是看到静默失败或样例感结果。

### P1：打通报告解锁和监控转化

1. 已实现 `GET /api/reports/:reportId`。
2. 已实现解锁报告时更新 `reports.unlocked`，并记录 lead 来源。
3. 结果页 `加入监控` 直接创建监控任务，而不是只跳转监控 tab。`done`
4. 监控页读取真实监控列表。`done`
5. 监控命中后写入站内消息，并按用户联系方式通知。

用户影响：一次查询可以自然进入持续监控，用户不会觉得按钮只是摆设。

### P2：重构异步任务边界

1. `POST /api/query-tasks` 只创建任务并返回 `queued`。
2. jobs 消费查询任务，执行工具服务，写回报告和状态。
3. 小程序轮询或订阅任务状态。
4. 增加任务失败状态和用户可理解的失败原因。

用户影响：后续接真实数据源时不会因为慢查询卡住页面，查询过程更稳定。

### P3：生产化与增长承接

1. 引入用户身份和授权策略。
2. 用正式数据库替换单文件 SQLite，或至少封装迁移和备份策略。
3. 增加顾问承接表单、分配状态和跟进记录。
4. 增加关键指标埋点：查询提交、结果查看、报告解锁、监控创建、顾问联系。

用户影响：从工具原型升级为可运营服务，能持续跟进风险和转化。

## 当前任务状态

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 初始化 monorepo | done | workspace、脚本、基础配置已完成 |
| 共享核心包 | done | 输入归一化、风险分级、报告预览已完成 |
| API 外壳和 SQLite | done | health、查询任务、SQLite schema 已完成 |
| 数据源连接器和工具服务 | partial | 服务接口已完成，但真实外部数据源未接入 |
| 队列、监控和通知处理 | partial | BullMQ 和处理器骨架已完成，真实调度和落库未打通 |
| 报告、线索、监控、消息接口 | partial | 报告详情、解锁状态、报告来源归因、监控创建和监控列表已完成；监控通知落库和顾问承接仍未完整闭环 |
| 小程序页面骨架 | done | 主要页面和 tab 已完成 |
| 结果页、报告页和完整链路 | partial | 查询、结果、报告解锁、报告详情、监控创建和监控列表已打通；监控通知和顾问承接仍未完整闭环 |

状态定义：

- `done`：代码、测试和文档均已完成，用户可按当前范围使用。
- `partial`：主路径或接口已存在，但仍有占位、mock、硬编码或缺少关键闭环。
- `todo`：尚未开始。
- `blocked`：因外部依赖、权限或关键决策无法继续。

## 后续维护规则

- 每完成一个开发任务，必须同步更新本文件的 `当前任务状态`。
- 如果任务来自某个 plan，也必须更新对应 `docs/superpowers/plans/*-plan.md` 的复选框或状态说明。
- 如果能力范围、目录约定或验证命令发生变化，先更新 `AGENTS.md` 或相关设计文档，再更新代码实践。
- 状态更新必须区分 `done` 和 `partial`，不能把 mock、硬编码或占位能力记为完成。

## 最近验证记录

验证时间：2026-04-21

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `PATH=/Users/xiaoan/.nvm/versions/node/v22.22.1/bin:$PATH pnpm lint` | pass | Biome 检查 164 个文件，无错误 |
| `PATH=/Users/xiaoan/.nvm/versions/node/v22.22.1/bin:$PATH pnpm test` | pass | 16 个测试文件、39 个测试全部通过 |
| `PATH=/Users/xiaoan/.nvm/versions/node/v22.22.1/bin:$PATH pnpm build` | pass | workspace 构建通过；Taro 构建仍有 `punycode` deprecation warning |

启动状态：

- API：`http://127.0.0.1:3000/health` 返回 `{"ok":true}`。
- Redis：Docker Compose `redis` 服务已运行，映射端口 `6379`。
- Mailpit：Docker Compose `mailpit` 服务已运行，Web UI 端口 `8025`。
- jobs worker：通过 `screen` 会话 `xiaochengxu-jobs` 后台运行。
- 小程序 weapp watch：通过 `screen` 会话 `xiaochengxu-miniprogram` 后台运行。

本次修复：

- 新增 `services/jobs/src/redis-options.ts`，将 BullMQ Redis 连接的 `maxRetriesPerRequest` 固定为 `null`。
- 更新 `services/jobs/src/queues.ts` 使用统一 Redis 连接配置。
- 新增 `tests/jobs/redis-options.test.ts`，防止后续改动破坏 BullMQ worker 必需配置。
- 小程序正式报告页解锁后会拉取并展示完整报告详情。
- 新增 `miniprogram/src/lib/report-detail-view-model.ts`，将报告详情接口返回值转换为页面展示模型。
- 更新 `miniprogram/src/components/report-unlock-screen.test.tsx`，覆盖解锁后完整报告渲染。
- 结果页 `加入监控` 会调用 `POST /api/monitors` 创建监控记录，然后进入监控页。
- 新增 `miniprogram/src/pages/result/index.test.tsx`，覆盖结果页创建监控的请求 payload。
- 新增 `GET /api/monitors`，返回已创建监控列表。
- 监控页改为读取 `/api/monitors`，不再渲染硬编码样例。
- 新增 `miniprogram/src/pages/monitor/index.test.tsx`，覆盖监控页接口读取。
