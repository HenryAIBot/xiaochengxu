import { Text, View } from "@tarojs/components";
import type { MessageItem } from "../lib/api";

const CHANNEL_LABELS: Record<MessageItem["channel"], string> = {
  email: "邮件",
  sms: "短信",
  system: "系统",
};

const LEVEL_BADGE: Record<string, string> = {
  clear: "badge badge--clear",
  watch: "badge badge--watch",
  suspected_high: "badge badge--high",
  confirmed: "badge badge--confirmed",
};

const LEVEL_LABELS: Record<string, string> = {
  clear: "安全",
  watch: "需关注",
  suspected_high: "疑似高风险",
  confirmed: "已确认",
};

function formatTime(iso: string): string {
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
      <View className="state">
        <Text className="state__title">暂无新消息</Text>
        <Text className="state__text">监控命中或系统动态会推送到这里</Text>
      </View>
    );
  }

  return (
    <View>
      {messages.map((message) => {
        const channelLabel = CHANNEL_LABELS[message.channel] ?? message.channel;
        const levelClass = message.level
          ? (LEVEL_BADGE[message.level] ?? "badge")
          : null;
        const levelText = message.level
          ? (LEVEL_LABELS[message.level] ?? message.level)
          : null;
        const recipient = message.toAddress ?? "—";

        return (
          <View key={message.id} className="list-item">
            <View className="list-item__row">
              <Text className="list-item__title">{channelLabel}</Text>
              {levelClass && levelText ? (
                <Text className={levelClass}>{levelText}</Text>
              ) : null}
            </View>
            <Text className="card__text" style={{ marginTop: "10px" }}>
              {message.body}
            </Text>
            <Text className="list-item__sub" style={{ marginTop: "8px" }}>
              接收：{recipient} · {formatTime(message.createdAt)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
