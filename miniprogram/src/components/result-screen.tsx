import { Button, Text, View } from "@tarojs/components";

const BADGE_CLASS: Record<string, string> = {
  clear: "badge badge--clear",
  watch: "badge badge--watch",
  suspected_high: "badge badge--high",
  confirmed: "badge badge--confirmed",
  需关注: "badge badge--watch",
  疑似高风险: "badge badge--high",
  已确认风险: "badge badge--confirmed",
  未发现明显风险: "badge badge--clear",
};

function levelToClass(level: string): string {
  return BADGE_CLASS[level] ?? "badge";
}

function dataSourceBadge(dataSource?: string): string | null {
  if (dataSource === "fixture") return "演示数据（非真实 API）";
  if (dataSource === "mixed") return "部分来源为演示数据";
  return null;
}

export function ResultScreen({
  toolName,
  summary,
  level,
  updatedAt,
  evidence,
  actions,
  dataSource,
  onUnlockReport,
  onStartMonitor,
  onContactAdvisor,
}: {
  toolName: string;
  summary: string;
  level: string;
  updatedAt: string;
  evidence: Array<{
    id: string;
    title: string;
    source: string;
    matchedField: string;
    description: string;
  }>;
  actions: string[];
  dataSource?: string;
  onUnlockReport(): void;
  onStartMonitor(): void;
  onContactAdvisor(): void;
}) {
  const badgeText = dataSourceBadge(dataSource);

  return (
    <View className="page">
      {badgeText ? (
        <Text className="badge badge--fixture">{badgeText}</Text>
      ) : null}

      <View className="card">
        <Text className={levelToClass(level)}>{level}</Text>
        <Text className="card__title" style={{ marginTop: "10px" }}>
          {toolName}结果
        </Text>
        <Text className="card__text">{summary}</Text>
        <Text className="card__meta" style={{ marginTop: "10px" }}>
          更新于 {updatedAt}
        </Text>
      </View>

      <View className="card">
        <Text className="card__title">关键证据</Text>
        {evidence.length > 0 ? (
          evidence.slice(0, 3).map((item) => (
            <View key={item.id} className="evidence-item">
              <Text className="evidence-item__title">{item.title}</Text>
              <Text className="evidence-item__source">
                来源：{item.source} · 命中字段：{item.matchedField}
              </Text>
              <Text className="evidence-item__body">{item.description}</Text>
            </View>
          ))
        ) : (
          <Text className="card__text">暂未发现可展示的关键证据</Text>
        )}
      </View>

      <View className="card">
        <Text className="card__title">建议动作</Text>
        <View className="action-list">
          {actions.map((action) => (
            <View key={action} className="action-list__item">
              <Text>{action}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="card">
        <Text className="card__title">解锁完整报告</Text>
        <Text className="card__text">
          查看完整证据、关联原因、案件列表和处理清单。
        </Text>
        <Button
          className="btn btn--primary btn--block"
          style={{ marginTop: "14px" }}
          onClick={onUnlockReport}
        >
          解锁完整报告
        </Button>
      </View>

      <View className="list-item__actions">
        <Button
          className="btn btn--secondary btn--block"
          onClick={onStartMonitor}
        >
          加入监控
        </Button>
        <Button
          className="btn btn--ghost btn--block"
          onClick={onContactAdvisor}
        >
          联系顾问
        </Button>
      </View>
    </View>
  );
}
