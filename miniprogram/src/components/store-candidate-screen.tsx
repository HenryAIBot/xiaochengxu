import { Button, Text, View } from "@tarojs/components";

export function StoreCandidateScreen({
  items,
  onSelect,
}: {
  items: Array<{ asin: string; title: string }>;
  onSelect(asin: string): void;
}) {
  return (
    <View>
      {items.map((item) => (
        <View key={item.asin}>
          <Button onClick={() => onSelect(item.asin)}>
            <Text>{item.title}</Text>
            <Text> / {item.asin}</Text>
          </Button>
        </View>
      ))}
    </View>
  );
}
