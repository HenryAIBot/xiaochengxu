# 结果页与报告解锁实施计划

> 面向执行者：本计划描述结果页和报告解锁的实现边界。代码路径、命令、组件名和 API 字段保留英文，其余说明使用中文。

**目标：** 构建一个先完成风险分诊、再承接完整报告解锁的结果页。用户可以用邮箱或手机号任意一种联系方式解锁完整报告。

**架构：** 小程序端由 `ResultScreen` 负责结果页层级，由 `ReportUnlockScreen` 负责联系方式采集。查询接口返回的结果先映射成页面视图模型，再渲染到结果页，避免页面直接依赖后端字段细节。

**技术栈：** TypeScript、React 18、Taro 组件、Testing Library、Vitest、Biome。

**当前状态：** 本计划内的小程序结果页、报告解锁组件、真实查询结果缓存接入和正式报告详情渲染已完成。后端报告详情接口、解锁状态更新和报告来源归因已完成。静态 demo 已支持查询后保存真实 `reportId`，解锁后拉取并展示完整报告。结果页 `加入监控` 已创建真实监控记录，监控页已读取真实监控列表；通知落库和生产级错误处理仍归入整体项目 `partial` 项，详见 `docs/superpowers/specs/2026-04-21-project-status.md`。

---

## 文件职责

- `miniprogram/src/components/result-screen.tsx`：展示风险结论、关键证据、建议动作和后续操作。
- `miniprogram/src/components/result-screen.test.tsx`：验证结果页可见内容和操作回调。
- `miniprogram/src/components/report-unlock-screen.tsx`：展示邮箱/手机号解锁表单，并处理空值提示与成功状态。
- `miniprogram/src/components/report-unlock-screen.test.tsx`：验证邮箱解锁、手机号解锁和空联系方式拦截。
- `miniprogram/src/lib/query-result-view-model.ts`：把接口返回的查询结果转换为中文页面展示模型。
- `miniprogram/src/lib/query-result-cache.ts`：缓存最近一次查询结果，供结果页和报告页读取。
- `miniprogram/src/pages/result/index.tsx`：从缓存读取查询结果并渲染结果页。
- `miniprogram/src/pages/report/index.tsx`：按真实 `reportId` 解锁报告。

## 任务 1：锁定结果页风险分诊行为

**涉及文件：**

- 修改：`miniprogram/src/components/result-screen.test.tsx`
- 修改：`miniprogram/src/components/result-screen.tsx`
- 修改：`miniprogram/src/pages/result/index.tsx`

- [x] **步骤 1：先写失败测试**

测试渲染 `ResultScreen`，断言风险等级、摘要、更新时间、关键证据、建议动作和三个操作按钮可见。

- [x] **步骤 2：运行测试确认失败**

运行：`pnpm vitest run miniprogram/src/components/result-screen.test.tsx`

预期：组件尚未支持证据、更新时间和操作回调时测试失败。

- [x] **步骤 3：实现最小组件行为**

补齐 `ResultScreen` 的证据、更新时间、解锁报告、加入监控和联系顾问回调。

- [x] **步骤 4：运行测试确认通过**

运行：`pnpm vitest run miniprogram/src/components/result-screen.test.tsx`

预期：测试通过。

## 任务 2：锁定邮箱或手机号解锁行为

**涉及文件：**

- 修改：`miniprogram/src/components/report-unlock-screen.test.tsx`
- 修改：`miniprogram/src/components/report-unlock-screen.tsx`

- [x] **步骤 1：先写失败测试**

测试仅邮箱、仅手机号、空联系方式拦截和成功状态展示。

- [x] **步骤 2：运行测试确认失败**

运行：`pnpm vitest run miniprogram/src/components/report-unlock-screen.test.tsx`

预期：旧组件只有硬编码邮箱按钮时测试失败。

- [x] **步骤 3：实现最小组件行为**

展示邮箱和手机号输入框；两项都空时提示 `请输入邮箱或手机号`；提交成功后展示 `完整报告已解锁`。

- [x] **步骤 4：运行测试确认通过**

运行：`pnpm vitest run miniprogram/src/components/report-unlock-screen.test.tsx`

预期：测试通过。

## 任务 3：接入真实查询结果

**涉及文件：**

- 新增：`miniprogram/src/lib/query-result-view-model.ts`
- 新增：`miniprogram/src/lib/query-result-cache.ts`
- 修改：`miniprogram/src/pages/home/index.tsx`
- 修改：`miniprogram/src/pages/select-product/index.tsx`
- 修改：`miniprogram/src/pages/result/index.tsx`
- 修改：`miniprogram/src/pages/report/index.tsx`

- [x] **步骤 1：建立中文视图模型**

把接口返回的风险等级、数据源、证据说明和建议动作转换为页面可直接展示的中文内容。

- [x] **步骤 2：缓存查询结果**

首页或商品选择页提交查询后，将查询结果按任务 ID 缓存，并带任务 ID 跳转结果页。

- [x] **步骤 3：结果页读取真实数据**

结果页按任务 ID 读取缓存数据，不再展示固定示例数据。

- [x] **步骤 4：报告页使用真实报告 ID**

解锁报告时使用查询结果中的 `reportId`，不再硬编码 `report-1`。

## 任务 4：渲染正式报告详情

**涉及文件：**

- 新增：`miniprogram/src/lib/report-detail-view-model.ts`
- 修改：`miniprogram/src/components/report-unlock-screen.test.tsx`
- 修改：`miniprogram/src/components/report-unlock-screen.tsx`
- 修改：`miniprogram/src/lib/api.ts`
- 修改：`miniprogram/src/pages/report/index.tsx`

- [x] **步骤 1：先写失败测试**

测试报告解锁成功返回详情后，页面展示完整报告、查询对象、摘要、证据和建议动作。

- [x] **步骤 2：运行测试确认失败**

运行：`pnpm vitest run miniprogram/src/components/report-unlock-screen.test.tsx`

结果：新增用例因找不到 `完整报告` 失败，确认旧组件只显示解锁成功提示。

- [x] **步骤 3：实现最小组件行为**

报告页解锁后调用 `GET /api/reports/:reportId`，并将返回结果映射成小程序可展示的完整报告视图模型。

- [x] **步骤 4：运行测试确认通过**

运行：`pnpm vitest run miniprogram/src/components/report-unlock-screen.test.tsx`

结果：4 个组件测试通过。

## 验证

运行：

```bash
pnpm lint
pnpm test
pnpm build
```

预期：全部命令退出码为 0。
