import { Text, View } from "@tarojs/components";
import type { MessageItem } from "../lib/api";

const CHANNEL_LABELS: Record<MessageItem["channel"], string> = {
  email: "邮件",
  sms: "短信",
  system: "系统",
};

const LEVEL_LABELS: Record<string, string> = {
  clear: "安全",
  watch: "需关注",
  suspected_high: "疑似高风险",
  confirmed: "已确认",
};

function formatTime(iso: string): string {
  // Keep YYYY-MM-DD HH:MM in the user's local zone. Taro's Text renders strings verbatim.
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MessageListScreen({
  messages,
}: {
  messages: MessageItem[];
}) {
  if (messages.length === 0) {
    return (
      <View>
        <Text>暂无新消息</Text>
      </View>
    );
  }

  return (
    <View>
      {messages.map((message) => {
        const channelLabel = CHANNEL_LABELS[message.channel] ?? message.channel;
        const levelLabel = message.level
          ? (LEVEL_LABELS[message.level] ?? message.level)
          : null;
        const recipient = message.toAddress ?? "—";

        return (
          <View key={message.id}>
            <View>
              <Text>{channelLabel}</Text>
              {levelLabel ? <Text> · {levelLabel}</Text> : null}
              <Text> · {formatTime(message.createdAt)}</Text>
            </View>
            <Text>{message.body}</Text>
            <Text>接收：{recipient}</Text>
          </View>
        );
      })}
    </View>
  );
}
