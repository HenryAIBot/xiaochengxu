# 项目约定

## 项目目标

本项目用于构建一个面向 `Amazon 美国站卖家` 的微信小程序，核心能力是：

- `侵权体检`
- `TRO 预警`
- `案件进展追踪`
- `报告解锁 + 顾问承接`

产品优先级：

1. 用户快速获得明确结果
2. 结果可解释、可复核
3. 查询自然转为持续监控
4. 自动化服务于转化，不为了炫技增加复杂度

## 目录约定

当前仓库是新项目，目录先按职责划分，后续实现时严格落位：

- `docs/superpowers/specs/`：产品设计、实现计划、关键决策文档
- `miniprogram/`：微信小程序前端
- `services/api/`：对外 API、鉴权、任务入口、内部回写端点
- `services/jobs/`：BullMQ Worker 与 processors（查询、通知、监控定时触发）
- `packages/core/`：领域模型、风险分级、报告预览
- `packages/tools/`：外部连接器（当前为 fixture）与工具服务，统一入口 `createDefaultToolExecutor` / `createDefaultMonitorChecker`
- `packages/queue/`：BullMQ 队列定义、`QueueClient` 接口、Redis 连接工厂
- `scripts/`：开发脚本、导入脚本、运维脚本
- `tests/`：端到端测试和跨模块集成测试

规则：

- 新文件必须放到所属职责目录，不允许把抓取、规则、接口逻辑混放
- 一次性分析脚本默认放 `/tmp`；确认需要复用后再迁入 `scripts/`
- 设计文档文件名使用 `YYYY-MM-DD-topic-design.md`
- 计划文档文件名使用 `YYYY-MM-DD-topic-plan.md`

## 命名约定

- 目录名使用 `kebab-case`
- TypeScript/JavaScript 变量与函数使用 `camelCase`
- 组件、类、类型使用 `PascalCase`
- 页面、接口、任务名优先体现用户意图，不用内部黑话命名
- 风险级别统一使用：
  - `clear`
  - `watch`
  - `suspected_high`
  - `confirmed`

## 工作约定

- 默认中文沟通，代码、命令、变量名使用英文
- 结论先行，然后补充为什么和对用户的影响
- 先定义规则，再写实现；需要改规范时，先改本文档再改代码
- 不为了让流程跑通而弱化报错或隐藏失败状态
- 不把密钥、token、密码写入仓库
- 每完成一个开发任务，必须同步更新任务状态文档：`docs/superpowers/specs/2026-04-21-project-status.md`
- 如果任务来自某个实施计划，必须同步更新对应 `docs/superpowers/plans/*-plan.md` 的复选框或状态说明
- 任务状态必须区分 `done`、`partial`、`todo`、`blocked`；mock、硬编码、占位实现不能标记为 `done`

## 验证约定

- 每次改动后主动运行对应验证：`test`、`lint`、`build`
- 如果暂时无法验证，必须明确写出原因和风险
- 结果页、通知内容、风险分级必须有可回归的测试样本

## 清理约定

- `.superpowers/`、日志、抓取缓存、导出文件不入库
- 临时排查文件在任务结束后删除
- 新增依赖前先确认是否可复用现有能力

## Git 与发布

- commit message 使用英文，简洁描述变更意图
- `git push` 只在用户明确要求时执行
- 发布使用项目自己的命令，不依赖 `git push`
