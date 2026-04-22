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

export function HomeScreen({
  onSubmit,
}: {
  onSubmit(input: { tool: Tool; input: string }): void;
}) {
  const [tool, setTool] = useState<Tool>("infringement_check");
  const [value, setValue] = useState("");
  const trimmed = value.trim();

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
              trimmed
                ? "btn btn--primary btn--block"
                : "btn btn--primary btn--block btn--disabled"
            }
            onClick={() => onSubmit({ tool, input: trimmed })}
          >
            立即检测
          </Button>
          <Text className="hint">
            示例：nike、apple、B0C1234567、1:25-cv-01234
          </Text>
        </View>

        <View className="stats-grid">
          <View className="stat-card">
            <Text className="stat-card__num">3</Text>
            <Text className="stat-card__label">活跃监控</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-card__num">12</Text>
            <Text className="stat-card__label">本周检测</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-card__num">2</Text>
            <Text className="stat-card__label">风险预警</Text>
          </View>
          <View className="stat-card">
            <Text className="stat-card__num">0</Text>
            <Text className="stat-card__label">已确认 TRO</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
