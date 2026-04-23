import { Button, Text, View } from "@tarojs/components";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "监控中",
  paused: "已暂停",
  stopped: "已停止",
};

const INTERVAL_PRESETS: Array<{ seconds: number; label: string }> = [
  { seconds: 300, label: "5 分钟" },
  { seconds: 900, label: "15 分钟" },
  { seconds: 3600, label: "1 小时" },
  { seconds: 14_400, label: "4 小时" },
  { seconds: 86_400, label: "每天" },
];

interface MonitorItem {
  id: string;
  targetValue: string;
  status: string;
  tickIntervalSeconds?: number | null;
}

export function MonitorListScreen({
  monitors,
  onToggleStatus,
  onDelete,
  onChangeInterval,
}: {
  monitors: MonitorItem[];
  onToggleStatus?: (
    id: string,
    next: "active" | "paused",
  ) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onChangeInterval?: (id: string, seconds: number) => void | Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

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

  async function runToggle(id: string, next: "active" | "paused") {
    if (!onToggleStatus || pendingId) return;
    setPendingId(id);
    try {
      await onToggleStatus(id, next);
    } finally {
      setPendingId(null);
    }
  }

  async function runDelete(id: string) {
    if (!onDelete || pendingId) return;
    setPendingId(id);
    setConfirmingDeleteId(null);
    try {
      await onDelete(id);
    } finally {
      setPendingId(null);
    }
  }

  async function runChangeInterval(id: string, seconds: number) {
    if (!onChangeInterval || pendingId) return;
    setPendingId(id);
    try {
      await onChangeInterval(id, seconds);
    } finally {
      setPendingId(null);
    }
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
        const isBusy = pendingId === monitor.id;
        const isConfirmingDelete = confirmingDeleteId === monitor.id;
        const currentInterval = monitor.tickIntervalSeconds ?? null;
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

            {onChangeInterval ? (
              <View className="mt-3">
                <Text className="hint">检测频率</Text>
                <View className="tool-selector">
                  {INTERVAL_PRESETS.map((preset) => {
                    const active = currentInterval === preset.seconds;
                    return (
                      <Button
                        key={preset.seconds}
                        className={
                          active
                            ? "tool-selector__btn tool-selector__btn--active"
                            : "tool-selector__btn"
                        }
                        disabled={isBusy}
                        onClick={() =>
                          void runChangeInterval(monitor.id, preset.seconds)
                        }
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {isConfirmingDelete ? (
              <View className="list-item__actions">
                <Text className="hint hint--error" style={{ flex: 1 }}>
                  确认删除这条监控？
                </Text>
                <Button
                  className={
                    isBusy
                      ? "btn btn--danger btn--compact btn--disabled"
                      : "btn btn--danger btn--compact"
                  }
                  disabled={isBusy}
                  onClick={() => void runDelete(monitor.id)}
                >
                  {isBusy ? "删除中…" : "确认删除"}
                </Button>
                <Button
                  className="btn btn--ghost btn--compact"
                  onClick={() => setConfirmingDeleteId(null)}
                >
                  取消
                </Button>
              </View>
            ) : (
              <View className="list-item__actions">
                {onToggleStatus ? (
                  <Button
                    className={
                      isBusy
                        ? "btn btn--ghost btn--compact btn--disabled"
                        : "btn btn--ghost btn--compact"
                    }
                    disabled={isBusy}
                    onClick={() => void runToggle(monitor.id, nextStatus)}
                  >
                    {isBusy ? "处理中…" : isActive ? "暂停" : "恢复"}
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button
                    className={
                      pendingId
                        ? "btn btn--danger-ghost btn--compact btn--disabled"
                        : "btn btn--danger-ghost btn--compact"
                    }
                    disabled={Boolean(pendingId)}
                    onClick={() => setConfirmingDeleteId(monitor.id)}
                  >
                    删除
                  </Button>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
