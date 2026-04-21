# 侵权风险监控小程序

## 当前状态

当前项目是面向 Amazon 美国站卖家的侵权风险与 TRO 监控小程序原型，已完成 monorepo、核心领域模型、API 骨架、小程序主链路、报告解锁和基础测试。

当前还不是生产可用版本。真实数据源、异步任务、持续监控通知、完整报告详情、顾问承接、鉴权和部署配置仍需补齐。

详细盘点见：`docs/superpowers/specs/2026-04-21-project-status.md`

## 本地开发

本项目本地开发统一使用 Node 22。API 依赖 `better-sqlite3`，它的原生绑定必须和当前 Node ABI 匹配。

1. `nvm use`
2. `pnpm install`
3. `./scripts/dev-up.sh`
4. `pnpm --filter @xiaochengxu/api dev`
5. `pnpm --filter @xiaochengxu/jobs dev`
6. `pnpm --filter @xiaochengxu/miniprogram dev`

## 验证

- `pnpm lint`
- `pnpm test`
- `pnpm build`
