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
  if (monitors.length === 0) {
    return (
      <View className="state">
        <Text className="state__title">暂无监控任务</Text>
        <Text className="state__text">
          去首页检测一次，再点"加入监控"把目标加进来
        </Text>
      </View>
    );
  }

  return (
    <View>
      {monitors.map((monitor) => {
        const isActive = monitor.status === "active";
        const nextStatus = isActive ? "paused" : "active";
        const statusClass = isActive
          ? "status-dot status-dot--active"
          : monitor.status === "paused"
            ? "status-dot status-dot--paused"
            : "status-dot";
        return (
          <View key={monitor.id} className="list-item">
            <View className="list-item__row">
              <View>
                <Text className="list-item__title">{monitor.targetValue}</Text>
                <Text className="list-item__sub">
                  状态：{STATUS_LABELS[monitor.status] ?? monitor.status}
                </Text>
              </View>
              <View className={statusClass} />
            </View>
            <View className="list-item__actions">
              {onToggleStatus ? (
                <Button
                  className="btn btn--ghost btn--compact"
                  onClick={() => onToggleStatus(monitor.id, nextStatus)}
                >
                  {isActive ? "暂停" : "恢复"}
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  className="btn btn--danger-ghost btn--compact"
                  onClick={() => onDelete(monitor.id)}
                >
                  删除
                </Button>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
