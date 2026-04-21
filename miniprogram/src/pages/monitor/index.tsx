import { View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { MonitorListScreen } from "../../components/monitor-list-screen";
import { type MonitorListItem, listMonitors } from "../../lib/api";

export default function MonitorPage() {
  const [monitors, setMonitors] = useState<MonitorListItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    listMonitors().then((result) => {
      if (isMounted) {
        setMonitors(result.items);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View>
      <MonitorListScreen monitors={monitors} />
    </View>
  );
}
