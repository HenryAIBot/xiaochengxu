import {
  BlankInputError,
  type NormalizedInput,
  type ToolName,
  normalizeInput,
} from "@xiaochengxu/core";
import type { FastifyInstance } from "fastify";
import { QueryTaskRepository } from "../repositories/query-task-repository.js";

interface QueryTaskBody {
  tool: ToolName;
  input: string;
}

const TOOL_NAMES = new Set<ToolName>([
  "infringement_check",
  "tro_alert",
  "case_progress",
]);

function isQueryTaskBody(body: unknown): body is QueryTaskBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.tool === "string" &&
    TOOL_NAMES.has(candidate.tool as ToolName) &&
    typeof candidate.input === "string"
  );
}

const RISK_LABELS: Record<string, string> = {
  clear: "安全",
  watch: "需关注",
  suspected_high: "疑似高风险",
  confirmed: "已确认",
};

interface QueryTaskRow {
  id: string;
  tool: string;
  input_kind: string;
  raw_input: string;
  normalized_input: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  failure_reason: string | null;
}

interface ReportRow {
  id: string;
  task_id: string;
  level: string;
  summary: string;
  evidence_json: unknown;
  recommended_actions_json: unknown;
  extra_json: unknown;
  unlocked: number | boolean;
  data_source: string | null;
  created_at: string | null;
  source_fetched_at: string | null;
}

// JSON columns land as strings in sqlite (stored as TEXT) and as
// parsed objects in postgres (stored as JSONB). Accept either shape.
function parseJsonArray(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function registerQueryTaskRoutes(app: FastifyInstance) {
  app.post("/api/query-tasks", async (request, reply) => {
    if (!isQueryTaskBody(request.body)) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "请求内容必须包含检测工具和输入内容",
      });
    }

    const repository = new QueryTaskRepository(app.db);
    let normalizedInput: NormalizedInput;

    try {
      normalizedInput = normalizeInput(request.body.input);
    } catch (error) {
      if (error instanceof BlankInputError) {
        return reply.code(400).send({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }

    const task = await repository.create({
      tool: request.body.tool,
      rawInput: request.body.input,
      normalizedInput,
      userId: request.user?.id ?? null,
    });

    await app.queue.enqueueQuery({ taskId: task.id });

    return reply.code(202).send({
      taskId: task.id,
      status: "pending",
      normalizedInput,
    });
  });

  app.get("/api/query-tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const userId = request.user?.id ?? null;
    const row = await app.db
      .prepare(
        `SELECT id, tool, input_kind, raw_input, normalized_input, status,
                created_at, updated_at, failure_reason, user_id
         FROM query_tasks WHERE id = ?`,
      )
      .get<QueryTaskRow & { user_id: string | null }>(taskId);

    if (!row || row.user_id !== userId) {
      return reply.code(404).send({ error: "task not found" });
    }

    const report = await app.db
      .prepare(
        `SELECT id, task_id, level, summary, evidence_json,
                recommended_actions_json, extra_json, unlocked, data_source,
                created_at, source_fetched_at
         FROM reports WHERE task_id = ?`,
      )
      .get<ReportRow>(taskId);

    const base = {
      taskId: row.id,
      status: row.status,
      tool: row.tool,
      normalizedInput: {
        kind: row.input_kind,
        rawValue: row.raw_input,
        normalizedValue: row.normalized_input,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.status === "failed") {
      return {
        ...base,
        failureReason: row.failure_reason,
      };
    }

    if (!report) {
      return base;
    }

    return {
      ...base,
      reportId: report.id,
      result: {
        level: report.level,
        levelLabel: RISK_LABELS[report.level] ?? report.level,
        summary: report.summary,
        evidence: parseJsonArray(report.evidence_json),
        recommendedActions: parseJsonArray(report.recommended_actions_json),
        extra: parseJsonValue(report.extra_json),
        dataSource: report.data_source ?? "fixture",
        createdAt: report.created_at,
        sourceFetchedAt: report.source_fetched_at,
      },
    };
  });
}
