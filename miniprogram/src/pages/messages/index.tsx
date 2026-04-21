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

  if (status.kind === "loading") {
    return (
      <View>
        <Text>加载消息中…</Text>
      </View>
    );
  }

  if (status.kind === "failed") {
    return (
      <View>
        <Text>{status.reason}</Text>
        <Button onClick={() => void load()}>重试</Button>
      </View>
    );
  }

  return <MessageListScreen messages={status.messages} />;
}
