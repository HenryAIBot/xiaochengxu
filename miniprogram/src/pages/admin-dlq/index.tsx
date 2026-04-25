import { Button, Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback, useEffect, useState } from "react";

interface FailedJob {
  jobId: string;
  name: string;
  data: unknown;
  failedReason: string | null;
  attemptsMade: number;
  failedAt: number | null;
}

const API_BASE =
  (typeof process !== "undefined" && process.env?.TARO_APP_API_BASE) ||
  "http://127.0.0.1:3000";

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

type PageStatus =
  | { kind: "loading" }
  | { kind: "ready"; jobs: FailedJob[] }
  | { kind: "failed"; reason: string };

async function fetchJson(
  url: string,
  init: { method?: string; token: string },
) {
  const response = await Taro.request({
    url,
    method: (init.method as "GET" | "POST") ?? "GET",
    header: { "x-internal-token": init.token },
  });
  const status = (response as { statusCode?: number }).statusCode ?? 0;
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}`);
  }
  return response.data;
}

export default function AdminDlqPage() {
  const [token, setToken] = useState<string>(() => {
    try {
      return (Taro.getStorageSync("internalToken") as string) ?? "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState<PageStatus>({ kind: "loading" });
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setStatus({
        kind: "failed",
        reason: "需要内部 token 才能访问 DLQ，请先填写",
      });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const data = (await fetchJson(
        `${API_BASE}/api/internal/notifications/failed`,
        { token },
      )) as { items?: FailedJob[] } | null;
      setStatus({ kind: "ready", jobs: data?.items ?? [] });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "加载失败队列失败";
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
      // ignore storage errors in test envs
    }
  }

  async function retry(jobId: string) {
    if (!token || retryingId) return;
    setRetryingId(jobId);
    try {
      await fetchJson(
        `${API_BASE}/api/internal/notifications/failed/${jobId}/retry`,
        { method: "POST", token },
      );
      Taro.showToast({ title: "已入队重试", icon: "success", duration: 1200 });
      await load();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "重试失败，请稍后再试";
      Taro.showToast({ title: reason, icon: "none", duration: 3000 });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">失败通知 DLQ</Text>
        <Text className="app-header__subtitle">
          查看并重试最终投递失败的通知
        </Text>
      </View>
      <View className="page">
        <View className="card">
          <Text className="card__title">Internal Token</Text>
          <Text className="card__text">与 API_INTERNAL_API_TOKEN 对齐</Text>
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

        {status.kind === "ready" && status.jobs.length === 0 ? (
          <View className="state">
            <Text className="state__title">当前无失败任务</Text>
            <Text className="state__text">
              通知在经过 3 次指数退避重试后仍失败才会进这里
            </Text>
          </View>
        ) : null}

        {status.kind === "ready"
          ? status.jobs.map((job) => {
              const isRetrying = retryingId === job.jobId;
              const failedAt = job.failedAt
                ? new Date(job.failedAt).toISOString()
                : "未知";
              return (
                <View key={job.jobId} className="list-item">
                  <View className="list-item__row">
                    <View style={{ flex: 1 }}>
                      <Text className="list-item__title">
                        #{job.jobId} · {job.name}
                      </Text>
                      <Text className="list-item__sub">
                        失败时间：{failedAt} · 尝试次数：{job.attemptsMade}
                      </Text>
                    </View>
                  </View>
                  {job.failedReason ? (
                    <Text className="evidence-item__body">
                      失败原因：{job.failedReason}
                    </Text>
                  ) : null}
                  <Text
                    className="hint"
                    style={{ whiteSpace: "pre-wrap" as const }}
                  >
                    {JSON.stringify(job.data, null, 2)}
                  </Text>
                  <View className="list-item__actions">
                    <Button
                      className={
                        isRetrying
                          ? "btn btn--primary btn--compact btn--disabled"
                          : "btn btn--primary btn--compact"
                      }
                      disabled={isRetrying || Boolean(retryingId)}
                      onClick={() => void retry(job.jobId)}
                    >
                      {isRetrying ? "重试中…" : "重新投递"}
                    </Button>
                  </View>
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
}
