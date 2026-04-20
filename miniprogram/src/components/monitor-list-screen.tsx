import { Text, View } from "@tarojs/components";

export function MonitorListScreen({
  monitors,
}: {
  monitors: Array<{ id: string; targetValue: string; status: string }>;
}) {
  return (
    <View>
      {monitors.map((monitor) => (
        <View key={monitor.id}>
          <Text>{monitor.targetValue}</Text>
          <Text> / {monitor.status}</Text>
        </View>
      ))}
    </View>
  );
}
