import { Text, View } from "@tarojs/components";

const STATUS_LABELS: Record<string, string> = {
  active: "监控中",
  paused: "已暂停",
  stopped: "已停止",
};

export function MonitorListScreen({
  monitors,
}: {
  monitors: Array<{ id: string; targetValue: string; status: string }>;
}) {
  return (
    <View>
      {monitors.length > 0 ? (
        monitors.map((monitor) => (
          <View key={monitor.id}>
            <Text>{monitor.targetValue}</Text>
            <Text> / {STATUS_LABELS[monitor.status] ?? monitor.status}</Text>
          </View>
        ))
      ) : (
        <Text>暂无监控任务</Text>
      )}
    </View>
  );
}
