# 真实数据源接入设计

> 日期：2026-04-25
> 适用范围：Amazon 美国站卖家微信小程序
> 当前结论：MVP 必接三类真实数据源：`CourtListener`、`USPTO trademark`、`Amazon listing/store`。接入顺序建议是先 CourtListener，后 USPTO 代理，最后 Amazon 商品数据代理。不要让小程序前端直连任何外部供应商，所有凭证和限流都必须留在服务端。

## 一句话方案

按用户目标倒推，真实数据源分三层：

1. `TRO 预警 / 案件进展`：接 CourtListener 官方 REST API，先覆盖联邦诉讼搜索和 docket entries。
2. `侵权体检`：接 USPTO 商标状态 + Amazon listing/store 文本证据，两者缺一不可。
3. `可复核报告`：每条证据保留 `sourceFetchedAt`、`dataSource`、`originalUrl`；展示给用户时明确来源与更新时间。

对用户的影响：

- 用户不再看到纯 fixture 判断，风险结论能追到真实页面。
- 侵权体检能解释“为什么可疑”，而不是只给一个等级。
- 数据源异常时可以显示“来源暂不可用/部分来源为演示数据”，避免把失败伪装成低风险。

## 当前代码接入点

现有 `packages/tools` 已经把外部数据源隔离在 connector 后面，真实接入不需要改小程序页面：

| 能力 | 当前入口 | 现有 env | 当前状态 |
| --- | --- | --- | --- |
| CourtListener | `LiveCourtListenerConnector` | `COURTLISTENER_API_TOKEN` / `COURTLISTENER_BASE_URL` | 已可 live |
| USPTO | `LiveMarkbaseTrademarkConnector` / `LiveUsptoTrademarkConnector` | `USPTO_SEARCH_PROVIDER=markbase` / `MARKBASE_*`，或 `USPTO_SEARCH_URL_TEMPLATE` / `USPTO_AUTH_HEADER` | 开发环境可直连 Markbase；生产可替换为自建 USPTO proxy |
| Amazon | `LiveAmazonListingConnector` / `LiveRainforestAmazonConnector` | `AMAZON_LISTING_URL_TEMPLATE` / `AMAZON_STORE_URL_TEMPLATE` / `RAINFOREST_API_KEY` | 查询与店铺候选都已接 connector；Rainforest 可直连 |
| 缓存 | `TtlCache` | `TOOL_CACHE_TTL_MS` | 已完成，默认 5 分钟 |
| 供应商限流 | token bucket wrapper | `PROVIDER_RATE_LIMIT_<NAME>_CAPACITY` / `_REFILL_MS` | 已完成 |
| 数据源状态 | `GET /api/internal/data-sources/status` | 读取上述 env | 已完成，内部 token 保护 |

重要原则：

- UI 只消费内部 API 的归一化结果，不理解供应商字段。
- 外部 token、API key、cookie 不进入小程序端。
- connector 抛错要保留为失败路径，不要吞掉后返回 `clear`。

## 数据源分级

### P0：必须接入

| 数据源 | 覆盖能力 | 推荐接入方式 | 为什么 |
| --- | --- | --- | --- |
| CourtListener REST API | TRO 预警、案件进展追踪 | 官方 REST API + token | 联邦诉讼和 docket entry 是 TRO 判断的核心事实来源；当前 connector 已支持 |
| USPTO Trademark / TSDR | 商标权属、商标状态、可复核链接 | 自建 USPTO proxy，内部再聚合 USPTO 官方数据 | USPTO 官方入口和数据结构会变化，用 proxy 固化本项目需要的字段，降低以后迁移成本 |
| Amazon Listing / Store | listing 文本、ASIN、店铺商品候选 | “SP-API 授权数据 + 公共商品数据代理”双轨 | 官方 SP-API 适合卖家授权后的自有数据；公开 ASIN/店铺查询通常需要付费数据服务或合规代理 |

### P1：增强接入

| 数据源 | 覆盖能力 | 推荐方式 | 进入时机 |
| --- | --- | --- | --- |
| PACER / RECAP 原文 | 诉状、TRO order、证据附件 | 优先通过 CourtListener/RECAP 链接，不足时再接 PACER 或付费法律数据服务 | 当用户开始付费解锁报告后 |
| 用户上传/授权数据 | listing CSV、后台截图、品牌授权文件 | 报告解锁后上传或 SP-API OAuth 授权 | Amazon 公共数据成本或稳定性不足时 |
| 顾问人工复核结果 | 最终判断、行动建议 | 后台标注结构化字段，回写报告 | 需要提高转化和降低误报时 |

### P2：暂不优先

| 数据源 | 原因 |
| --- | --- |
| 图片/logo 相似度数据 | 有价值，但在文本商标和诉讼数据未稳定前，容易增加误报和解释成本 |
| 社媒/站外投诉数据 | 对 TRO 主路径帮助有限，噪声高 |
| 大规模卖家经营数据 | 涉及授权、合规和隐私，MVP 不应先做 |

## CourtListener 接入

### 用途

- `tro_alert`：按品牌词或店铺名搜索近期联邦案件。
- `case_progress`：按案件号查询 docket entries。
- 监控轮询：品牌、店铺、案件号的持续变化检测。

### 推荐方式

直接使用 CourtListener 官方 REST API。官方文档说明 REST API 支持认证 token，当前代码使用：

```http
Authorization: Token <COURTLISTENER_API_TOKEN>
```

当前 connector 调用：

```text
GET /api/rest/v4/search/?q={target}&type=r&order_by=dateFiled+desc
GET /api/rest/v4/docket-entries/?docket__docket_number={caseNumber}&order_by=-date_filed
```

### 操作步骤

1. 注册 CourtListener 账号并申请 API token。
2. 在后端运行环境设置：

```bash
COURTLISTENER_API_TOKEN=...
COURTLISTENER_BASE_URL=https://www.courtlistener.com
PROVIDER_RATE_LIMIT_COURTLISTENER_CAPACITY=10
PROVIDER_RATE_LIMIT_COURTLISTENER_REFILL_MS=1000
```

3. 重启 `api` 和 `jobs` 服务。
4. 本地用 curl 做供应商连通性检查：

```bash
curl -H "Authorization: Token $COURTLISTENER_API_TOKEN" \
  "https://www.courtlistener.com/api/rest/v4/search/?q=nike&type=r&order_by=dateFiled+desc"
```

5. 用系统内查询验证：

```bash
curl -X POST "http://localhost:3000/api/query-tasks" \
  -H "Content-Type: application/json" \
  -d '{"tool":"tro_alert","input":"nike"}'
```

6. 查询完成后检查报告：

- `dataSource` 应为 `live`。
- `sourceFetchedAt` 应为当前查询时间。
- CourtListener 证据应带 `originalUrl`。

### 验收标准

- 搜索品牌词能返回真实案件证据，无法返回时明确失败或空结果。
- 案件号能返回 docket 更新。
- 监控任务触发时不会超过供应商限流。
- 报告里的每条 CourtListener 证据都能点击到原始来源。

### 风险与处理

- 关键词搜索会误命中：需要做 plaintiff/brand alias、日期窗口和法院辖区权重。
- docket number 可能格式不一致：后续应增加案件号归一化。
- CourtListener 不是 PACER 全量替代：关键付费报告需要支持人工补充诉状/order 原文。

## USPTO 接入

### 用途

- `infringement_check`：判断输入品牌词是否命中美国商标。
- 报告解释：展示权利人、商标名、状态、TSDR 可复核链接。

### 推荐方式

开发阶段先用 Markbase 的真实 USPTO 商标索引快速跑通，生产阶段仍推荐做一个自有 `USPTO proxy`：

```text
GET /marks?q={term}
```

返回本项目稳定契约：

```json
{
  "marks": [
    {
      "owner": "Nike, Inc.",
      "mark": "NIKE",
      "status": "LIVE",
      "serialNumber": "73379389",
      "detailUrl": "https://tsdr.uspto.gov/#caseNumber=73379389&caseType=SERIAL_NO&searchType=statusSearch"
    }
  ]
}
```

当前 `LiveUsptoTrademarkConnector` 可接受裸数组或 `{ "results": [] }`、`{ "marks": [] }`、`{ "data": [] }`。

### 为什么要 proxy

- USPTO 公开系统包含 TSDR、Open Data Portal、bulk data 等不同入口，能力边界不同。
- TSDR 适合查单个 serial/registration 的状态和详情，不一定适合直接做自由文本搜索。
- Open Data Portal 已迁移到新门户，官方历史 beta portal 公告显示计划在 2026-05-29 下线；直接依赖旧入口会给生产留下迁移风险。
- proxy 可以统一 owner/mark/status/url 字段，让小程序、报告、测试都不跟供应商字段耦合。

### 操作步骤

1. 先实现内部 proxy endpoint，例如：

```text
GET https://your-uspto-proxy.example/marks?q={termEncoded}
```

2. 开发环境可先配置 Markbase：

```bash
USPTO_SEARCH_PROVIDER=markbase
MARKBASE_API_BASE_URL=https://api.markbase.co
MARKBASE_STATUS_CODES=700,800
```

当前 connector 默认只取 `700,800`，对应 live registered / renewed trademarks，用于降低 dead/abandoned 商标对风险判断的噪声。

3. proxy 内部优先使用 USPTO 官方数据：

- 搜索阶段：调用可用的 USPTO trademark search / ODP 数据接口，或用定期同步的 bulk dataset 建索引。
- 详情阶段：用 TSDR serial number 补状态页链接。
- 归一化阶段：只返回 `owner`、`mark`、`status`、`serialNumber`、`detailUrl`。

3. 在 API/jobs 环境设置：

```bash
USPTO_SEARCH_PROVIDER=markbase
MARKBASE_API_BASE_URL=https://api.markbase.co
MARKBASE_STATUS_CODES=700,800

# 或生产自建 proxy
# USPTO_SEARCH_URL_TEMPLATE=https://your-uspto-proxy.example/marks?q={termEncoded}
# USPTO_AUTH_HEADER=Bearer your-token
PROVIDER_RATE_LIMIT_USPTO_CAPACITY=10
PROVIDER_RATE_LIMIT_USPTO_REFILL_MS=1000
```

4. 跑真实 endpoint 条件烟雾测试：

```bash
USPTO_LIVE_TEST_URL_TEMPLATE="https://your-uspto-proxy.example/marks?q={termEncoded}" \
USPTO_LIVE_TEST_TERM="nike" \
USPTO_LIVE_TEST_AUTH_HEADER="Bearer your-token" \
pnpm vitest run tests/tools/uspto-live-smoke.test.ts
```

5. 再走完整工具链：

```bash
curl -X POST "http://localhost:3000/api/query-tasks" \
  -H "Content-Type: application/json" \
  -d '{"tool":"infringement_check","input":"nike"}'
```

### 验收标准

- `nike`、`apple`、`stanley` 这类强品牌词能返回 live marks。
- 拼写大小写不影响结果。
- 每条商标证据有权利人、商标名、状态和 TSDR 链接。
- USPTO proxy 故障时任务失败可见，不返回虚假的 `clear`。

### 风险与处理

- 商标状态字段复杂：先把状态归一到 `LIVE` / `DEAD` / `UNKNOWN`，不要让 UI 展示供应商原始长字段。
- 词语可能是普通词也是商标：报告必须展示“命中商标，不等于一定侵权”，由 listing 使用场景和法院案件共同加权。
- USPTO 数据更新频率不是实时：报告里必须展示 `sourceFetchedAt`。

## Amazon 接入

### 用途

- `infringement_check`：抓取 listing title/bullets/description 中的品牌词、权利人词、风险表达。
- `storefront candidate`：从店铺名列出候选 ASIN，让用户不用手填。
- 监控：定期检查店铺或 ASIN 相关风险。

### 推荐方式

使用双轨：

1. 卖家授权数据：Amazon Selling Partner API。
2. 公开商品/店铺数据：合规代理或付费商品数据 API，例如 Rainforest API、Keepa 等。

原因：

- Amazon SP-API 是官方卖家 API，适合用户授权后的自有 catalog/listings 数据。
- 但本产品还需要查“任意 ASIN/店铺”的公开页面证据，SP-API 并不等于一个免费公共商品页抓取 API。
- 直接在 jobs 里爬 Amazon 页面会遇到 ToS、反爬、地区、验证码和稳定性问题，不应作为生产主路径。

### 当前 connector 契约

listing endpoint：

```text
GET https://your-amazon-proxy.example/listing?asin={asinEncoded}
```

可返回 raw HTML，或：

```json
{ "html": "<html>...</html>" }
```

store endpoint：

```text
GET https://your-amazon-proxy.example/store?name={storeEncoded}
```

必须返回：

```json
{
  "items": [
    { "asin": "B0XXXXXXX", "title": "Product title" }
  ]
}
```

### 操作步骤

1. 决策供应商：

- 已有卖家授权场景：先接 SP-API OAuth，拿用户自己的 catalog/listings。
- 需要公共 ASIN/店铺查询：采购 Rainforest/Keepa 等服务，或自建合规代理。

2. 若选择 Rainforest，可直接配置 `RAINFOREST_API_KEY`，不需要先建内部 Amazon proxy；若选择其他供应商，再建内部 Amazon proxy，把供应商字段转成当前 connector 契约。

3. Rainforest 直连方式：

```bash
RAINFOREST_API_KEY=your-key
RAINFOREST_API_BASE_URL=https://api.rainforestapi.com/request
RAINFOREST_AMAZON_DOMAIN=amazon.com
```

4. 自建 proxy 方式：

```bash
AMAZON_LISTING_URL_TEMPLATE=https://your-amazon-proxy.example/listing?asin={asinEncoded}
AMAZON_STORE_URL_TEMPLATE=https://your-amazon-proxy.example/store?name={storeEncoded}
AMAZON_AUTH_HEADER=Bearer your-token
PROVIDER_RATE_LIMIT_AMAZON_CAPACITY=5
PROVIDER_RATE_LIMIT_AMAZON_REFILL_MS=2000
```

5. 用 ASIN 做完整链路验证：

```bash
curl -X POST "http://localhost:3000/api/query-tasks" \
  -H "Content-Type: application/json" \
  -d '{"tool":"infringement_check","input":"B0XXXXXXX"}'
```

6. 用店铺名验证候选商品：

```bash
curl "http://localhost:3000/api/storefronts/example-store/products"
```

7. 上线前确认数据源状态：

```bash
curl -H "x-internal-token: $INTERNAL_API_TOKEN" \
  "http://localhost:3000/api/internal/data-sources/status"
```

### 验收标准

- ASIN 查询能得到 listing HTML 并提取文本证据。
- 店铺查询能返回候选 ASIN 列表，标题可读。
- Amazon 证据不伪造 `originalUrl`；如果 proxy 能提供 Amazon 页面 URL，再传递到 evidence。
- Amazon 失败时 `infringement_check` 不应静默降级成完全正常；若 USPTO live + Amazon fixture 混用，应显示 `mixed`。

### 风险与处理

- 成本风险：公共商品数据 API 通常按请求量收费，必须启用缓存和监控频率上限。
- 合规风险：不要保存用户 Seller Central 凭证；SP-API 使用 OAuth 授权和 refresh token。
- 稳定性风险：同一个 ASIN 在不同地区/邮编/登录态看到的内容可能不同，proxy 需要固定 marketplace 为 US。

## 推荐实施顺序

### 第 1 步：CourtListener live 上线

优先级最高，因为它投入最低、对 TRO 预警价值最大。

交付物：

- 生产环境配置 `COURTLISTENER_API_TOKEN`。
- `tro_alert` 和 `case_progress` 能返回 `dataSource: "live"`。
- 结果页/报告页能打开 CourtListener 原始链接。

### 第 2 步：USPTO proxy

交付物：

- `GET /marks?q=` proxy 契约稳定。
- 条件 smoke test 跑通真实 endpoint。
- `infringement_check` 的品牌词路径从 fixture 切到 live。

### 第 3 步：Amazon proxy / 付费 API

交付物：

- `GET /listing?asin=` 返回 HTML 或 `{ html }`。
- `GET /store?name=` 返回 `{ items }`。
- ASIN 路径从 fixture 切到 live。

### 第 4 步：证据审计与供应商健康

交付物：

- 每条 evidence 记录 source、originalUrl、sourceFetchedAt。
- API 增加供应商健康检查或后台运维页。
- 外部失败率、耗时、限流命中进入日志/监控。

## 环境变量清单

```bash
# Cache
TOOL_CACHE_TTL_MS=300000

# CourtListener
COURTLISTENER_API_TOKEN=
COURTLISTENER_BASE_URL=https://www.courtlistener.com
PROVIDER_RATE_LIMIT_COURTLISTENER_CAPACITY=10
PROVIDER_RATE_LIMIT_COURTLISTENER_REFILL_MS=1000

# USPTO proxy
USPTO_SEARCH_URL_TEMPLATE=https://your-uspto-proxy.example/marks?q={termEncoded}
USPTO_AUTH_HEADER=Bearer your-token
PROVIDER_RATE_LIMIT_USPTO_CAPACITY=10
PROVIDER_RATE_LIMIT_USPTO_REFILL_MS=1000

# Amazon proxy
AMAZON_LISTING_URL_TEMPLATE=https://your-amazon-proxy.example/listing?asin={asinEncoded}
AMAZON_STORE_URL_TEMPLATE=https://your-amazon-proxy.example/store?name={storeEncoded}
AMAZON_AUTH_HEADER=Bearer your-token
PROVIDER_RATE_LIMIT_AMAZON_CAPACITY=5
PROVIDER_RATE_LIMIT_AMAZON_REFILL_MS=2000

# Rainforest direct Amazon integration
RAINFOREST_API_KEY=
RAINFOREST_API_BASE_URL=https://api.rainforestapi.com/request
RAINFOREST_AMAZON_DOMAIN=amazon.com
```

本地开发时 API / jobs 会自动读取项目根目录 `.env`；`.env.example` 只保留字段名和非敏感默认值，真实 key 放 `.env`。

## 测试样本

| 场景 | 输入 | 期望 |
| --- | --- | --- |
| 强品牌侵权体检 | `nike` | USPTO 命中 live marks，风险至少 `watch` |
| ASIN 体检 | 一个真实 Amazon US ASIN | Amazon listing live，能提取标题/描述证据 |
| TRO 预警 | `nike` / `stanley` | CourtListener 返回近期案件或明确空结果 |
| 案件进展 | 真实 docket number | docket entries 可读，按日期倒序 |
| 店铺候选 | 真实店铺名 | 返回候选 ASIN + title |
| 部分数据源失败 | USPTO live + Amazon 未配置 | `dataSource: "mixed"` 或任务失败可见，UI 不把结果伪装成完全真实 |

## 不建议现在做

- 不建议在小程序端直连 Amazon、USPTO、CourtListener。
- 不建议为了省事直接爬 Amazon 页面作为生产主路径。
- 不建议先做图片/logo 相似度，再补商标和诉讼数据。
- 不建议供应商失败时默认返回低风险。
- 不建议把供应商原始字段透传给 UI；字段应在 connector/proxy 层归一化。

## 参考来源

- CourtListener REST API：<https://www.courtlistener.com/help/api/rest/>
- CourtListener API search：<https://www.courtlistener.com/help/api/rest/search/>
- USPTO TSDR API：<https://developer.uspto.gov/api-catalog/tsdr-data-api>
- USPTO Open Data Portal：<https://data.uspto.gov/>
- Amazon SP-API Catalog Items：<https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference>
- Amazon SP-API 授权文档：<https://developer-docs.amazon.com/sp-api/docs/selling-partner-appstore-authorization-workflow>
- Rainforest API 文档：<https://www.rainforestapi.com/docs>
