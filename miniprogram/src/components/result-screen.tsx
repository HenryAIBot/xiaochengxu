import { Button, Text, View } from "@tarojs/components";
import { useState } from "react";
import type { TimelineEntry } from "../lib/query-result-view-model";
import { TimelineSection } from "./timeline-section";

const MONITOR_INTERVAL_PRESETS: Array<{
  seconds: number;
  label: string;
}> = [
  { seconds: 300, label: "5 分钟" },
  { seconds: 900, label: "15 分钟" },
  { seconds: 3600, label: "1 小时" },
  { seconds: 14_400, label: "4 小时" },
  { seconds: 86_400, label: "每天" },
];

const BADGE_CLASS: Record<string, string> = {
  clear: "badge badge--clear",
  watch: "badge badge--watch",
  suspected_high: "badge badge--high",
  confirmed: "badge badge--confirmed",
  需关注: "badge badge--watch",
  疑似高风险: "badge badge--high",
  已确认风险: "badge badge--confirmed",
  未发现明显风险: "badge badge--clear",
};

function levelToClass(level: string): string {
  return BADGE_CLASS[level] ?? "badge";
}

function dataSourceBadge(dataSource?: string): string | null {
  if (dataSource === "live") return "真实数据（外部 API）";
  if (dataSource === "fixture") return "演示数据（非真实 API）";
  if (dataSource === "mixed") return "部分来源为演示数据";
  return null;
}

export function ResultScreen({
  toolName,
  summary,
  level,
  updatedAt,
  evidence,
  actions,
  dataSource,
  timeline,
  onUnlockReport,
  onStartMonitor,
  onContactAdvisor,
  onActionTap,
}: {
  toolName: string;
  summary: string;
  level: string;
  updatedAt: string;
  evidence: Array<{
    id: string;
    title: string;
    source: string;
    matchedField: string;
    description: string;
    originalUrl?: string;
  }>;
  actions: string[];
  dataSource?: string;
  timeline?: TimelineEntry[];
  onUnlockReport(): void;
  onStartMonitor(input: {
    tickIntervalSeconds: number;
  }): void | Promise<void>;
  onContactAdvisor(): void;
  onActionTap?: (action: string) => void;
}) {
  const badgeText = dataSourceBadge(dataSource);
  const [isStartingMonitor, setIsStartingMonitor] = useState(false);
  const [monitorPickerOpen, setMonitorPickerOpen] = useState(false);
  // Default: every 15 minutes — sane middle ground for risk-change cadence.
  const [tickIntervalSeconds, setTickIntervalSeconds] = useState(900);

  async function handleStartMonitor() {
    if (isStartingMonitor) return;
    setIsStartingMonitor(true);
    try {
      await onStartMonitor({ tickIntervalSeconds });
      setMonitorPickerOpen(false);
    } finally {
      setIsStartingMonitor(false);
    }
  }

  return (
    <View className="page">
      {badgeText ? (
        <Text className="badge badge--fixture">{badgeText}</Text>
      ) : null}

      <View className="card">
        <Text className={levelToClass(level)}>{level}</Text>
        <Text className="card__title" style={{ marginTop: "10px" }}>
          {toolName}结果
        </Text>
        <Text className="card__text">{summary}</Text>
        <Text className="card__meta" style={{ marginTop: "10px" }}>
          更新于 {updatedAt}
        </Text>
      </View>

      <View className="card">
        <Text className="card__title">关键证据</Text>
        {evidence.length > 0 ? (
          evidence.slice(0, 3).map((item) => (
            <View key={item.id} className="evidence-item">
              <Text className="evidence-item__title">{item.title}</Text>
              <Text className="evidence-item__source">
                来源：{item.source} · 命中字段：{item.matchedField}
              </Text>
              <Text className="evidence-item__body">{item.description}</Text>
              {item.originalUrl ? (
                <Text
                  className="evidence-item__link"
                  onClick={() => {
                    if (typeof window !== "undefined" && item.originalUrl) {
                      window.open(item.originalUrl, "_blank");
                    }
                  }}
                >
                  查看原始来源 ↗
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text className="card__text">暂未发现可展示的关键证据</Text>
        )}
      </View>

      {timeline && timeline.length > 0 ? (
        <TimelineSection timeline={timeline} />
      ) : null}

      <View className="card">
        <Text className="card__title">建议动作</Text>
        <View className="action-list">
          {actions.map((action) => (
            <View
              key={action}
              className={
                onActionTap
                  ? "action-list__item action-list__item--tappable"
                  : "action-list__item"
              }
              onClick={onActionTap ? () => onActionTap(action) : undefined}
            >
              <Text>{action}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="card">
        <Text className="card__title">解锁完整报告</Text>
        <Text className="card__text">
          查看完整证据、关联原因、案件列表和处理清单。
        </Text>
        <Button
          className="btn btn--primary btn--block"
          style={{ marginTop: "14px" }}
          onClick={onUnlockReport}
        >
          解锁完整报告
        </Button>
      </View>

      {monitorPickerOpen ? (
        <View className="card card--highlight">
          <Text className="card__title">选择检测频率</Text>
          <Text className="card__text">
            频率越密耗时越多，一般 15 分钟或 1 小时够用
          </Text>
          <View className="tool-selector">
            {MONITOR_INTERVAL_PRESETS.map((preset) => {
              const active = tickIntervalSeconds === preset.seconds;
              return (
                <Button
                  key={preset.seconds}
                  className={
                    active
                      ? "tool-selector__btn tool-selector__btn--active"
                      : "tool-selector__btn"
                  }
                  disabled={isStartingMonitor}
                  onClick={() => setTickIntervalSeconds(preset.seconds)}
                >
                  {preset.label}
                </Button>
              );
            })}
          </View>
          <View className="list-item__actions" style={{ marginTop: "10px" }}>
            <Button
              className={
                isStartingMonitor
                  ? "btn btn--primary btn--block btn--disabled"
                  : "btn btn--primary btn--block"
              }
              disabled={isStartingMonitor}
              onClick={() => void handleStartMonitor()}
            >
              {isStartingMonitor ? "加入中…" : "确认加入监控"}
            </Button>
            <Button
              className="btn btn--ghost btn--block"
              disabled={isStartingMonitor}
              onClick={() => setMonitorPickerOpen(false)}
            >
              取消
            </Button>
          </View>
        </View>
      ) : null}

      <View className="list-item__actions">
        <Button
          className={
            isStartingMonitor
              ? "btn btn--secondary btn--block btn--disabled"
              : "btn btn--secondary btn--block"
          }
          disabled={isStartingMonitor}
          onClick={() =>
            monitorPickerOpen
              ? void handleStartMonitor()
              : setMonitorPickerOpen(true)
          }
        >
          {isStartingMonitor ? "加入中…" : "加入监控"}
        </Button>
        <Button
          className="btn btn--ghost btn--block"
          onClick={onContactAdvisor}
        >
          联系顾问
        </Button>
      </View>
    </View>
  );
}
