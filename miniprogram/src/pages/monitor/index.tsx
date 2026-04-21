import { View } from "@tarojs/components";
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
  );
}
