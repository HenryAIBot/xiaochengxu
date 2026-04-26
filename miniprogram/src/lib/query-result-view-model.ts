export type QueryTool = "infringement_check" | "tro_alert" | "case_progress";

export interface TimelineDocument {
  url: string;
  description?: string;
  pageCount?: number;
  isAvailable?: boolean;
}

export interface TimelineEntry {
  at: string;
  event: string;
  documents?: TimelineDocument[];
}

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
  dataSource?: string;
  sourceFetchedAt?: string | null;
  timeline?: TimelineEntry[];
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
    originalUrl?: string;
  }>;
  actions: string[];
  dataSource?: string;
  timeline?: TimelineEntry[];
}

export interface CompletedTaskStatus {
  taskId: string;
  status: "completed";
  tool: string;
  normalizedInput: { kind: string; normalizedValue: string };
  reportId?: string;
  result?: {
    level: string;
    levelLabel: string;
    summary: string;
    evidence: Array<{
      source: string;
      level: string;
      reason: string;
      originalUrl?: string;
    }>;
    recommendedActions: string[];
    dataSource?: string;
    sourceFetchedAt?: string | null;
    extra?: unknown;
  };
}

export function extractTimelineFromExtra(
  extra: unknown,
): TimelineEntry[] | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const candidate = (extra as { timeline?: unknown }).timeline;
  if (!Array.isArray(candidate)) return undefined;
  const entries: TimelineEntry[] = [];
  for (const raw of candidate) {
    if (!raw || typeof raw !== "object") continue;
    const at = (raw as { at?: unknown }).at;
    const event = (raw as { event?: unknown }).event;
    if (typeof at !== "string" || typeof event !== "string") continue;
    const docsRaw = (raw as { documents?: unknown }).documents;
    const documents: TimelineDocument[] = [];
    if (Array.isArray(docsRaw)) {
      for (const doc of docsRaw) {
        if (!doc || typeof doc !== "object") continue;
        const url = (doc as { url?: unknown }).url;
        if (typeof url !== "string" || url.length === 0) continue;
        const description = (doc as { description?: unknown }).description;
        const pageCount = (doc as { pageCount?: unknown }).pageCount;
        const isAvailable = (doc as { isAvailable?: unknown }).isAvailable;
        documents.push({
          url,
          ...(typeof description === "string" ? { description } : {}),
          ...(typeof pageCount === "number" ? { pageCount } : {}),
          ...(typeof isAvailable === "boolean" ? { isAvailable } : {}),
        });
      }
    }
    entries.push({
      at,
      event,
      ...(documents.length > 0 ? { documents } : {}),
    });
  }
  return entries.length > 0 ? entries : undefined;
}

export function flattenCompletedTask(
  status: CompletedTaskStatus,
): QueryTaskResult {
  if (!status.reportId || !status.result) {
    throw new Error("flattenCompletedTask requires reportId and result");
  }
  return {
    id: status.taskId,
    reportId: status.reportId,
    status: "completed",
    tool: status.tool as QueryTool,
    normalizedInput: status.normalizedInput,
    level: status.result.level,
    levelLabel: status.result.levelLabel,
    summary: status.result.summary,
    evidence: status.result.evidence,
    recommendedActions: status.result.recommendedActions,
    dataSource: status.result.dataSource,
    sourceFetchedAt: status.result.sourceFetchedAt,
    timeline: extractTimelineFromExtra(status.result.extra),
  };
}

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "刚刚更新";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "刚刚更新";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
    updatedAt: formatUpdatedAt(result.sourceFetchedAt),
    evidence: result.evidence.slice(0, 3).map((item, index) => ({
      id: `${item.source}-${index}`,
      title: SOURCE_TITLES[item.source] ?? "风险信号",
      source: SOURCE_LABELS[item.source] ?? item.source,
      matchedField: "风险信号",
      description: item.reason,
      originalUrl: item.originalUrl,
    })),
    actions:
      result.recommendedActions.length > 0
        ? result.recommendedActions
        : ["继续观察"],
    dataSource: result.dataSource,
    ...(result.timeline ? { timeline: result.timeline } : {}),
  };
}
