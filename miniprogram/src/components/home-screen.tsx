import { Button, Input, Text, View } from "@tarojs/components";
import { useState } from "react";

type Tool = "infringement_check" | "tro_alert" | "case_progress";

interface ToolOption {
  key: Tool;
  label: string;
}

const TOOLS: ToolOption[] = [
  { key: "infringement_check", label: "侵权体检" },
  { key: "tro_alert", label: "TRO 预警" },
  { key: "case_progress", label: "案件进展" },
];

function readInputValue(event: {
  detail?: { value?: string };
  target?: { value?: string };
}) {
  return event.detail?.value ?? event.target?.value ?? "";
}

export interface HomeStats {
  activeMonitors: number;
  detectionsThisWeek: number;
  riskWarnings: number;
  confirmedTro: number;
}

export function HomeScreen({
  onSubmit,
  stats,
}: {
  onSubmit(input: { tool: Tool; input: string }): Promise<unknown> | unknown;
  stats?: HomeStats | null;
}) {
  const [tool, setTool] = useState<Tool>("infringement_check");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trimmed = value.trim();
  const disabled = !trimmed || submitting;

  async function handleSubmit() {
    if (disabled) return;
    setSubmitting(true);
    try {
      await onSubmit({ tool, input: trimmed });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View className="app-header">
        <Text className="app-header__title">TRO 风险预警</Text>
        <Text className="app-header__subtitle">
          Amazon 美国站卖家侵权检测工具
        </Text>
      </View>

      <View className="page">
        <View className="card">
          <Text className="card__title">快速风险检测</Text>
          <Input
            className="input"
            placeholder="品牌词 / 店铺名 / ASIN / 案件号"
            value={value}
            onInput={(event) => setValue(readInputValue(event))}
            onChange={(event) => setValue(readInputValue(event))}
          />
          <View className="tool-selector">
            {TOOLS.map((option) => {
              const active = tool === option.key;
              const className = active
                ? "tool-selector__btn tool-selector__btn--active"
                : "tool-selector__btn";
              return (
                <Button
                  key={option.key}
                  className={className}
                  onClick={() => setTool(option.key)}
                >
                  {option.label}
                </Button>
              );
            })}
          </View>
          <Button
            className={
              disabled
                ? "btn btn--primary btn--block btn--disabled"
                : "btn btn--primary btn--block"
            }
            onClick={() => void handleSubmit()}
          >
            {submitting ? "检测中…" : "立即检测"}
          </Button>
          <Text className="hint">
            示例：nike、apple、B0C1234567、1:25-cv-01234
          </Text>
        </View>

        <View className="stats-grid">
          <View className="stat-card">
            <Text className="stat-card__num">
              {stats?.activeMonitors ?? "—"}
            </Text>
            <Text className="stat-card__label">活跃监控</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-card__num">
              {stats?.detectionsThisWeek ?? "—"}
            </Text>
            <Text className="stat-card__label">本周检测</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-card__num">{stats?.riskWarnings ?? "—"}</Text>
            <Text className="stat-card__label">风险预警</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-card__num">{stats?.confirmedTro ?? "—"}</Text>
            <Text className="stat-card__label">已确认 TRO</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
