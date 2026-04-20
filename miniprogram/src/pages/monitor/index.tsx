import { View } from "@tarojs/components";
import { MonitorListScreen } from "../../components/monitor-list-screen";

export default function MonitorPage() {
  return (
    <View>
      <MonitorListScreen
        monitors={[{ id: "monitor-1", targetValue: "nike", status: "active" }]}
      />
    </View>
  );
}
