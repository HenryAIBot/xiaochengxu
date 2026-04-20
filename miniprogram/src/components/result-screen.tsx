import { Text, View } from "@tarojs/components";

export function ResultScreen({
  summary,
  level,
  actions,
}: {
  summary: string;
  level: string;
  actions: string[];
}) {
  return (
    <View>
      <Text>{level}</Text>
      <Text>{summary}</Text>
      <View>
        {actions.map((action) => (
          <Text key={action}>{action}</Text>
        ))}
      </View>
    </View>
  );
}
