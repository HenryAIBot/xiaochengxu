export type DataSourceProvider =
  | "courtlistener"
  | "uspto"
  | "amazon"
  | "unknown";

export interface ClassifiedDataSourceError {
  provider: DataSourceProvider;
  /** Friendly Chinese message suitable for showing to end users. */
  friendlyMessage: string;
  /** Original raw error message for logs / debugging. */
  rawMessage: string;
}

const PROVIDER_PATTERNS: Array<{
  test: RegExp;
  provider: DataSourceProvider;
  label: string;
}> = [
  { test: /CourtListener/i, provider: "courtlistener", label: "法院案件检索" },
  { test: /USPTO TSDR/i, provider: "uspto", label: "USPTO 商标官方查询" },
  {
    test: /Markbase trademark search/i,
    provider: "uspto",
    label: "USPTO 商标检索",
  },
  { test: /Rainforest API/i, provider: "amazon", label: "Amazon 商品查询" },
  {
    test: /Rainforest product response/i,
    provider: "amazon",
    label: "Amazon 商品查询",
  },
  {
    test: /Amazon listing fetch/i,
    provider: "amazon",
    label: "Amazon 商品查询",
  },
  {
    test: /Amazon storefront fetch/i,
    provider: "amazon",
    label: "Amazon 店铺查询",
  },
];

function detailFromMessage(message: string): string {
  const httpMatch = message.match(/(\d{3})\s+([A-Za-z][\w ]+)/);
  if (httpMatch) {
    const code = Number(httpMatch[1]);
    if (code === 401 || code === 403) return "凭证或授权问题，请检查 API key";
    if (code === 404) return "记录不存在或路径变更";
    if (code === 429) return "供应商限流，请稍后重试";
    if (code >= 500) return "供应商服务暂时不可用";
    return `供应商返回 ${code}`;
  }
  if (/timeout|aborted|ETIMEDOUT|ECONNRESET/i.test(message)) {
    return "网络超时，请稍后重试";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return "无法解析供应商域名";
  }
  return "请稍后重试";
}

export function classifyDataSourceError(
  err: unknown,
): ClassifiedDataSourceError {
  const rawMessage = err instanceof Error ? err.message : String(err);
  for (const pattern of PROVIDER_PATTERNS) {
    if (pattern.test.test(rawMessage)) {
      return {
        provider: pattern.provider,
        friendlyMessage: `${pattern.label}暂不可用：${detailFromMessage(rawMessage)}`,
        rawMessage,
      };
    }
  }
  return {
    provider: "unknown",
    friendlyMessage: `检测过程出现错误：${rawMessage}`,
    rawMessage,
  };
}

export class DataSourceError extends Error {
  readonly provider: DataSourceProvider;
  readonly rawMessage: string;
  constructor(classified: ClassifiedDataSourceError) {
    super(classified.friendlyMessage);
    this.name = "DataSourceError";
    this.provider = classified.provider;
    this.rawMessage = classified.rawMessage;
  }
}
