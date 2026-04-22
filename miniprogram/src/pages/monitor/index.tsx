import { Text, View } from "@tarojs/components";
import { useCallback, useEffect, useState } from "react";
import { MonitorListScreen } from "../../components/monitor-list-screen";
import {
  type MonitorListItem,
  deleteMonitor,
  listMonitors,
  updateMonitorStatus,
} from "../../lib/api";

export default function MonitorPage() {
  const [monitors, setMonitors] = useState<MonitorListItem[]>([]);

  const reload = useCallback(async () => {
    const result = await listMonitors();
    setMonitors(result.items);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">监控列表</Text>
        <Text className="app-header__subtitle">
          每 5 分钟自动轮询命中即推送
        </Text>
      </View>
      <View className="page">
        <MonitorListScreen
          monitors={monitors}
          onToggleStatus={async (id, next) => {
            await updateMonitorStatus(id, next);
            await reload();
          }}
          onDelete={async (id) => {
            await deleteMonitor(id);
            await reload();
          }}
        />
      </View>
    </View>
  );
}
