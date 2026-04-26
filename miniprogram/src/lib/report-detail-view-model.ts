import {
  type TimelineEntry,
  extractTimelineFromExtra,
} from "./query-result-view-model";

export interface ReportDetail {
  id: string;
  unlocked: boolean;
  query: {
    taskId: string;
    tool: string;
    inputKind: string;
    rawInput: string;
    normalizedInput: string;
    createdAt: string;
  };
  preview: {
    level: string;
    summary: string;
    evidence: Array<{
      source: string;
      level: string;
      reason: string;
      originalUrl?: string;
    }>;
    recommendedActions: string[];
    extra: unknown;
    dataSource?: string;
    reportCreatedAt?: string | null;
  };
}

export interface FullReportViewModel {
  id: string;
  queryInput: string;
  toolName: string;
  level: string;
  summary: string;
  evidence: Array<{
    id: string;
    source: string;
    level: string;
    reason: string;
    originalUrl?: string;
  }>;
  actions: string[];
  dataSource?: string;
  timeline?: TimelineEntry[];
}

const TOOL_LABELS: Record<string, string> = {
  infringement_check: "侵权体检",
  tro_alert: "TRO 预警",
  case_progress: "案件进展",
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

export function toFullReportViewModel(
  report: ReportDetail,
): FullReportViewModel {
  return {
    id: report.id,
    queryInput: report.query.normalizedInput || report.query.rawInput,
    toolName: TOOL_LABELS[report.query.tool] ?? report.query.tool,
    level: LEVEL_LABELS[report.preview.level] ?? report.preview.level,
    summary: report.preview.summary,
    evidence: report.preview.evidence.map((item, index) => ({
      id: `${item.source}-${index}`,
      source: SOURCE_LABELS[item.source] ?? item.source,
      level: LEVEL_LABELS[item.level] ?? item.level,
      reason: item.reason,
      originalUrl: item.originalUrl,
    })),
    actions:
      report.preview.recommendedActions.length > 0
        ? report.preview.recommendedActions
        : ["继续观察"],
    dataSource: report.preview.dataSource,
    ...(extractTimelineFromExtra(report.preview.extra)
      ? {
          timeline: extractTimelineFromExtra(
            report.preview.extra,
          ) as TimelineEntry[],
        }
      : {}),
  };
}
