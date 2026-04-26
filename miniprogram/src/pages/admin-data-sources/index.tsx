import { Button, Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback, useEffect, useState } from "react";

interface CapabilityStatus {
  provider: string;
  capability: string;
  dataSource: "fixture" | "live" | "mixed";
  configured: boolean;
  requiredEnv: string[];
  optionalEnv: string[];
  missingEnv: string[];
}

const API_BASE =
  (typeof process !== "undefined" && process.env?.TARO_APP_API_BASE) ||
  "http://127.0.0.1:3000";

const PROVIDER_LABELS: Record<string, string> = {
  courtlistener: "CourtListener · 法院记录",
  uspto: "USPTO · 商标库",
  amazon: "Amazon · 商品/店铺",
};

const CAPABILITY_LABELS: Record<string, string> = {
  court_search: "案件搜索",
  docket_entries: "案件 docket 进展",
  trademark_search: "商标检索",
  listing_lookup: "ASIN listing 查询",
  storefront_lookup: "店铺商品候选",
};

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

type PageStatus =
  | { kind: "loading" }
  | { kind: "ready"; items: CapabilityStatus[] }
  | { kind: "failed"; reason: string };

export default function AdminDataSourcesPage() {
  const [token, setToken] = useState<string>(() => {
    try {
      return (Taro.getStorageSync("internalToken") as string) ?? "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState<PageStatus>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!token) {
      setStatus({
        kind: "failed",
        reason: "需要内部 token 才能访问数据源状态，请先填写",
      });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const response = await Taro.request({
        url: `${API_BASE}/api/internal/data-sources/status`,
        method: "GET",
        header: { "x-internal-token": token },
      });
      const code = (response as { statusCode?: number }).statusCode ?? 0;
      if (code < 200 || code >= 300) throw new Error(`HTTP ${code}`);
      const data = response.data as { items?: CapabilityStatus[] } | null;
      setStatus({ kind: "ready", items: data?.items ?? [] });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "加载数据源状态失败";
      setStatus({ kind: "failed", reason });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function saveToken(value: string) {
    setToken(value);
    try {
      Taro.setStorageSync("internalToken", value);
    } catch {
      // ignore
    }
  }

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">数据源健康状态</Text>
        <Text className="app-header__subtitle">
          live / fixture 实时检查 + 缺失 env 提示
        </Text>
      </View>
      <View className="page">
        <View className="card">
          <Text className="card__title">Internal Token</Text>
          <Text className="card__text">
            与 INTERNAL_API_TOKEN 对齐。token 仅本地缓存。
          </Text>
          <Input
            className="input"
            placeholder="内部 token"
            value={token}
            onInput={(e) => saveToken(readInputValue(e))}
            onChange={(e) => saveToken(readInputValue(e))}
          />
          <Button
            className="btn btn--ghost btn--block"
            onClick={() => void load()}
          >
            刷新
          </Button>
        </View>

        {status.kind === "loading" ? (
          <View className="state">
            <View className="spinner" />
            <Text className="state__text">加载中…</Text>
          </View>
        ) : null}

        {status.kind === "failed" ? (
          <View className="state">
            <Text className="state__title">加载失败</Text>
            <Text className="state__text">{status.reason}</Text>
          </View>
        ) : null}

        {status.kind === "ready" && status.items.length === 0 ? (
          <View className="state">
            <Text className="state__title">无可展示的数据源</Text>
          </View>
        ) : null}

        {status.kind === "ready"
          ? status.items.map((item, index) => {
              const providerLabel =
                PROVIDER_LABELS[item.provider] ?? item.provider;
              const capabilityLabel =
                CAPABILITY_LABELS[item.capability] ?? item.capability;
              const badgeText =
                item.dataSource === "live"
                  ? "真实数据"
                  : item.dataSource === "mixed"
                    ? "部分真实"
                    : "演示数据";
              const badgeClass =
                item.dataSource === "live"
                  ? "badge badge--clear"
                  : item.dataSource === "mixed"
                    ? "badge badge--watch"
                    : "badge badge--fixture";
              return (
                <View
                  key={`${item.provider}-${item.capability}-${index}`}
                  className="list-item"
                >
                  <View className="list-item__row">
                    <View style={{ flex: 1 }}>
                      <Text className="list-item__title">
                        {providerLabel} · {capabilityLabel}
                      </Text>
                      <Text className="list-item__sub">
                        {item.configured ? "已配置" : "未配置"}
                      </Text>
                    </View>
                    <Text className={badgeClass}>{badgeText}</Text>
                  </View>
                  {item.missingEnv.length > 0 ? (
                    <Text className="evidence-item__body">
                      缺失 env：{item.missingEnv.join(", ")}
                    </Text>
                  ) : null}
                  {item.requiredEnv.length > 0 ? (
                    <Text className="evidence-item__source">
                      必填 env：{item.requiredEnv.join(", ")}
                    </Text>
                  ) : null}
                  {item.optionalEnv.length > 0 ? (
                    <Text className="evidence-item__source">
                      可选 env：{item.optionalEnv.join(", ")}
                    </Text>
                  ) : null}
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
}
