import { Button, Text, View } from "@tarojs/components";

const STATUS_LABELS: Record<string, string> = {
  active: "监控中",
  paused: "已暂停",
  stopped: "已停止",
};

interface MonitorItem {
  id: string;
  targetValue: string;
  status: string;
}

export function MonitorListScreen({
  monitors,
  onToggleStatus,
  onDelete,
}: {
  monitors: MonitorItem[];
  onToggleStatus?: (id: string, next: "active" | "paused") => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <View>
      {monitors.length > 0 ? (
        monitors.map((monitor) => {
          const isActive = monitor.status === "active";
          const nextStatus = isActive ? "paused" : "active";
          return (
            <View key={monitor.id}>
              <Text>{monitor.targetValue}</Text>
              <Text> / {STATUS_LABELS[monitor.status] ?? monitor.status}</Text>
              {onToggleStatus ? (
                <Button onClick={() => onToggleStatus(monitor.id, nextStatus)}>
                  {isActive ? "暂停" : "恢复"}
                </Button>
              ) : null}
              {onDelete ? (
                <Button onClick={() => onDelete(monitor.id)}>删除</Button>
              ) : null}
            </View>
          );
        })
      ) : (
        <Text>暂无监控任务</Text>
      )}
    </View>
  );
}
