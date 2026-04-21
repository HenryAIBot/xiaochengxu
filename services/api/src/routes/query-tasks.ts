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
  evidence_json: string;
  recommended_actions_json: string;
  extra_json: string | null;
  unlocked: number;
  data_source: string | null;
  created_at: string | null;
  source_fetched_at: string | null;
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonValue(raw: string | null | undefined): unknown {
  if (!raw) return null;
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

    const task = repository.create({
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
    const row = app.db
      .prepare(
        `SELECT id, tool, input_kind, raw_input, normalized_input, status,
                created_at, updated_at, failure_reason, user_id
         FROM query_tasks WHERE id = ?`,
      )
      .get(taskId) as (QueryTaskRow & { user_id: string | null }) | undefined;

    if (!row || row.user_id !== userId) {
      return reply.code(404).send({ error: "task not found" });
    }

    const report = app.db
      .prepare(
        `SELECT id, task_id, level, summary, evidence_json,
                recommended_actions_json, extra_json, unlocked, data_source,
                created_at, source_fetched_at
         FROM reports WHERE task_id = ?`,
      )
      .get(taskId) as ReportRow | undefined;

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
