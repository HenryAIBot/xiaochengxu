export type ToolName = "infringement_check" | "tro_alert" | "case_progress";
export type RiskLevel = "clear" | "watch" | "suspected_high" | "confirmed";

export interface DetectionSignal {
  source: string;
  level: RiskLevel;
  reason: string;
  /** Optional external URL the seller can open to see the raw evidence. */
  originalUrl?: string;
}

const LEVEL_ORDER: RiskLevel[] = [
  "clear",
  "watch",
  "suspected_high",
  "confirmed",
];

const ACTIONS: Record<RiskLevel, string[]> = {
  clear: ["继续观察"],
  watch: ["加入持续监控", "关注新案与品牌词变化"],
  suspected_high: ["立即复核商品页品牌词与图片", "准备联系顾问"],
  confirmed: ["立即处理高风险商品页", "联系顾问并准备申诉/和解材料"],
};

export function compareRiskLevelSeverity(
  left: RiskLevel,
  right: RiskLevel,
): number {
  return LEVEL_ORDER.indexOf(left) - LEVEL_ORDER.indexOf(right);
}

export function pickPrimarySignal(
  signals: DetectionSignal[],
): DetectionSignal | undefined {
  return signals.reduce<DetectionSignal | undefined>((current, signal) => {
    if (!current) {
      return signal;
    }

    return compareRiskLevelSeverity(signal.level, current.level) > 0
      ? signal
      : current;
  }, undefined);
}

export function summarizeRisk(tool: ToolName, signals: DetectionSignal[]) {
  const primarySignal = pickPrimarySignal(signals);
  const level = primarySignal?.level ?? "clear";

  return {
    tool,
    level,
    recommendedActions: [...ACTIONS[level]],
    headline: primarySignal?.reason ?? "未发现明显风险",
  };
}
