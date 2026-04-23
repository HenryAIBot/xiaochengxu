# 微信小程序上线 Runbook

> 从本地开发到提交审核的完整步骤。外部动作（需要微信后台 / 真人操作）
> 标注为 ⚠️ 人工；其余是仓库里已经准备好的命令。

## 1. 获取 AppID / AppSecret ⚠️ 人工

1. 登录微信公众平台 <https://mp.weixin.qq.com>（个人号注册不了，需用企业主体或已注册的小程序账号）。
2. 「开发管理」→「开发设置」→ 复制 **AppID** 与 **AppSecret**。
3. 同一页「服务器域名」里，把 API 域名（`https://your-api.example.com`）加到 **request 合法域名**。本地调试用「不校验合法域名」开关。

## 2. 后端环境变量

本地 / 测试 / 生产分别写入 `.env` 或 docker env：

```bash
WECHAT_APPID=wx0123456789abcdef
WECHAT_SECRET=real-secret-from-wechat
# 可选：若走代理转发 jscode2session，覆盖官方 URL
# WECHAT_JSCODE2SESSION_URL=https://your-proxy.example/sns/jscode2session
```

后端启动时会读取；没配置时 `/api/auth/wechat` 会返回 503（匿名鉴权仍可用）。

## 3. 前端构建

```bash
# 微信小程序 (mp-weixin) 模式
TARO_APP_API_BASE=https://your-api.example.com \
  pnpm --filter @xiaochengxu/miniprogram build
# 产物在 miniprogram/dist/
```

H5 构建：

```bash
TARO_APP_API_BASE=https://your-api.example.com \
  pnpm --filter @xiaochengxu/miniprogram build:h5
# 产物在 miniprogram/dist/（同目录，编译模式不同）
```

## 4. 微信开发者工具预览 ⚠️ 人工

1. 打开「微信开发者工具」→「小程序」→「导入项目」。
2. 项目目录指向 `miniprogram/dist/`（weapp 模式构建的产物）。
3. 填入第 1 步的 AppID。
4. 点击「预览」生成二维码；用开发者本人的微信扫码加入白名单后可在真机查看。

## 5. 体验版发布 ⚠️ 人工

1. 开发者工具右上角「上传」→ 填写版本号、备注（如 `v0.1.0-experience`）。
2. 进入公众平台「版本管理」→「开发版本」→ 把刚传上去的版本设为「体验版」。
3. 在公众平台「成员管理」→「体验成员」里添加测试者 OpenID。被添加者在微信里直接搜小程序或点小程序码即可打开。

## 6. 正式提审 ⚠️ 人工

1. 公众平台「版本管理」→「开发版本」→ 点「提交审核」。
2. 填写：
   - 基础信息（类目、标签、服务范围）。
   - 小程序备案信息（2024 年起强制，需营业执照 + 法人身份证）。
   - 审核说明：提供测试账号/路径，方便审核员复现"立即检测 → 解锁报告 → 提交咨询"主链路。
3. 等待 1–7 个工作日。被驳回最常见原因：
   - 服务类目与实际功能不符 → 选「工具 / 其他」。
   - 手机号验证未按《微信小程序用户隐私保护指引》声明 → 我们已经在「提交咨询」做二次确认，审核说明里把这点挑明。
   - 外部跳转未在页面内声明 → 本工程暂无外部跳转。

## 7. 发布正式版 ⚠️ 人工

审核通过后，公众平台「版本管理」→「审核版本」→「发布」。发布后默认走
阶段灰度（0% → 1% → 10% → 50% → 100%），在后台随时可调整百分比或回滚。

## 8. 线上监控

后端：
- `SENTRY_DSN` 设了会自动走 Sentry（见 `.env.example`）；没装 `@sentry/node` 时降级到结构化 stderr。
- `docker compose logs api jobs` 看 JSON 审计流 + 错误流。
- 数据库：如果 `DATABASE_URL=postgres://...`，建议在 Postgres 开启 slow-query log（`log_min_duration_statement`）。

前端：
- 微信后台「性能监控」看启动耗时 / 页面 FPS。
- `wx.reportMonitor` 自定义指标（暂未接入；追踪在 project-status.md）。

## 9. 回滚

- 后端：回退到上一个 git tag 重建容器，sqlite/pg 数据只增不破坏；若是数据库迁移不向前兼容，参照 `services/api/src/lib/postgres-schema.sql` 手工 down。
- 小程序：公众平台「发布管理」→「回滚到上一版本」一键生效。
