import { Button, Text, View } from "@tarojs/components";

export function ResultScreen({
  toolName,
  summary,
  level,
  updatedAt,
  evidence,
  actions,
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
  onUnlockReport(): void;
  onStartMonitor(): void;
  onContactAdvisor(): void;
}) {
  return (
    <View>
      <View>
        <Text>{toolName}结果</Text>
        <Text>{level}</Text>
        <Text>{summary}</Text>
        <Text>更新于 {updatedAt}</Text>
      </View>

      <View>
        <Text>关键证据</Text>
        {evidence.length > 0 ? (
          evidence.slice(0, 3).map((item) => (
            <View key={item.id}>
              <Text>{item.title}</Text>
              <Text>
                来源：{item.source} · 命中字段：{item.matchedField}
              </Text>
              <Text>{item.description}</Text>
            </View>
          ))
        ) : (
          <Text>暂未发现可展示的关键证据</Text>
        )}
      </View>

      <View>
        <Text>建议动作</Text>
        {actions.map((action) => (
          <Text key={action}>{action}</Text>
        ))}
      </View>

      <View>
        <Text>解锁完整报告</Text>
        <Text>查看完整证据、关联原因、案件列表和处理清单。</Text>
        <Button onClick={onUnlockReport}>解锁完整报告</Button>
      </View>

      <View>
        <Button onClick={onStartMonitor}>加入监控</Button>
        <Button onClick={onContactAdvisor}>联系顾问</Button>
      </View>
    </View>
  );
}
