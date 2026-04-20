import {
  type DetectionSignal,
  type RiskLevel,
  type ToolName,
  pickPrimarySignal,
  summarizeRisk,
} from "./risk.js";

export interface ReportPreview {
  tool: ToolName;
  level: RiskLevel;
  summary: string;
  evidence: DetectionSignal[];
  recommendedActions: string[];
}

export function buildPreview(input: {
  tool: ToolName;
  evidence: DetectionSignal[];
}): ReportPreview {
  const riskSummary = summarizeRisk(input.tool, input.evidence);
  const primarySignal = pickPrimarySignal(input.evidence);
  const prioritizedEvidence = primarySignal
    ? [
        primarySignal,
        ...input.evidence.filter((signal) => signal !== primarySignal),
      ]
    : [];

  return {
    tool: input.tool,
    level: riskSummary.level,
    summary: primarySignal?.reason ?? "暂无命中记录",
    evidence: prioritizedEvidence.slice(0, 3),
    recommendedActions: [...riskSummary.recommendedActions],
  };
}
