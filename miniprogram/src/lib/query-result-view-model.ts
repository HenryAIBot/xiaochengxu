export type QueryTool = "infringement_check" | "tro_alert" | "case_progress";

export interface QueryTaskResult {
  id: string;
  reportId: string;
  status: string;
  tool?: QueryTool;
  normalizedInput: {
    kind: string;
    normalizedValue: string;
  };
  level: string;
  levelLabel: string;
  summary: string;
  evidence: Array<{
    source: string;
    level: string;
    reason: string;
  }>;
  recommendedActions: string[];
}

export interface ResultViewModel {
  taskId: string;
  reportId: string;
  monitorTarget: {
    targetKind: string;
    targetValue: string;
  };
  toolName: string;
  level: string;
  summary: string;
  updatedAt: string;
  evidence: Array<{
    id: string;
    title: string;
    source: string;
    matchedField: string;
    description: string;
  }>;
  actions: string[];
}

const TOOL_LABELS: Record<QueryTool, string> = {
  infringement_check: "侵权体检",
  tro_alert: "TRO 预警",
  case_progress: "案件进展",
};

const SOURCE_TITLES: Record<string, string> = {
  amazon: "亚马逊商品页信号",
  courtlistener: "法院案件信号",
  uspto: "美国商标命中",
};

const SOURCE_LABELS: Record<string, string> = {
  amazon: "亚马逊商品页",
  courtlistener: "美国法院记录",
  uspto: "美国商标库",
};

const LEVEL_LABELS: Record<string, string> = {
  clear: "未发现明显风险",
  watch: "需关注",
  suspected_high: "疑似高风险",
  confirmed: "已确认风险",
};

function inferTool(result: QueryTaskResult): QueryTool {
  if (result.tool) {
    return result.tool;
  }

  if (result.normalizedInput.kind === "asin") {
    return "infringement_check";
  }

  return "tro_alert";
}

export function toResultViewModel(result: QueryTaskResult): ResultViewModel {
  const tool = inferTool(result);

  return {
    taskId: result.id,
    reportId: result.reportId,
    monitorTarget: {
      targetKind: result.normalizedInput.kind,
      targetValue: result.normalizedInput.normalizedValue,
    },
    toolName: TOOL_LABELS[tool],
    level: LEVEL_LABELS[result.level] ?? result.levelLabel,
    summary: result.summary,
    updatedAt: "刚刚更新",
    evidence: result.evidence.slice(0, 3).map((item, index) => ({
      id: `${item.source}-${index}`,
      title: SOURCE_TITLES[item.source] ?? "风险信号",
      source: SOURCE_LABELS[item.source] ?? item.source,
      matchedField: "风险信号",
      description: item.reason,
    })),
    actions:
      result.recommendedActions.length > 0
        ? result.recommendedActions
        : ["继续观察"],
  };
}
