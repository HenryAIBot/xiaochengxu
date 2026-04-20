import { Button, Text, View } from "@tarojs/components";

export function ReportUnlockScreen({
  onUnlock,
}: {
  onUnlock(input: { email: string; phone?: string }): void;
}) {
  return (
    <View>
      <Text>解锁完整报告</Text>
      <Button onClick={() => onUnlock({ email: "seller@example.com" })}>
        邮箱解锁
      </Button>
    </View>
  );
}
