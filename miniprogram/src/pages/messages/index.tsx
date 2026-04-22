import { Button, Text, View } from "@tarojs/components";
import { useCallback, useEffect, useState } from "react";
import { MessageListScreen } from "../../components/message-list-screen";
import { type MessageItem, listMessages } from "../../lib/api";

type PageStatus =
  | { kind: "loading" }
  | { kind: "ready"; messages: MessageItem[] }
  | { kind: "failed"; reason: string };

export default function MessagesPage() {
  const [status, setStatus] = useState<PageStatus>({ kind: "loading" });

  const load = useCallback(async () => {
    setStatus({ kind: "loading" });
    try {
      const messages = await listMessages();
      setStatus({ kind: "ready", messages });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "加载消息失败，请稍后重试";
      setStatus({ kind: "failed", reason });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">消息通知</Text>
        <Text className="app-header__subtitle">监控命中 · 系统动态</Text>
      </View>
      <View className="page">
        {status.kind === "loading" ? (
          <View className="state">
            <View className="spinner" />
            <Text className="state__text">加载消息中…</Text>
          </View>
        ) : null}
        {status.kind === "failed" ? (
          <View className="state">
            <Text className="state__title">加载失败</Text>
            <Text className="state__text">{status.reason}</Text>
            <Button
              className="btn btn--primary btn--compact"
              style={{ marginTop: "14px" }}
              onClick={() => void load()}
            >
              重试
            </Button>
          </View>
        ) : null}
        {status.kind === "ready" ? (
          <MessageListScreen messages={status.messages} />
        ) : null}
      </View>
    </View>
  );
}
