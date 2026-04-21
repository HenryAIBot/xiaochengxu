import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

interface UnlockReportBody {
  email?: string;
  phone?: string;
}

interface StoredReportRow {
  id: string;
  taskId: string;
  level: string;
  summary: string;
  evidenceJson: string;
  recommendedActionsJson: string;
  extraJson: string | null;
  unlocked: number;
  tool: string;
  inputKind: string;
  rawInput: string;
  normalizedInput: string;
  createdAt: string;
}

function parseJsonField<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getReport(app: FastifyInstance, reportId: string) {
  return app.db
    .prepare(
      `SELECT reports.id,
              reports.task_id AS taskId,
              reports.level,
              reports.summary,
              reports.evidence_json AS evidenceJson,
              reports.recommended_actions_json AS recommendedActionsJson,
              reports.extra_json AS extraJson,
              reports.unlocked,
              query_tasks.tool,
              query_tasks.input_kind AS inputKind,
              query_tasks.raw_input AS rawInput,
              query_tasks.normalized_input AS normalizedInput,
              query_tasks.created_at AS createdAt
       FROM reports
       INNER JOIN query_tasks ON query_tasks.id = reports.task_id
       WHERE reports.id = ?`,
    )
    .get(reportId) as StoredReportRow | undefined;
}

function serializeReport(row: StoredReportRow) {
  return {
    id: row.id,
    unlocked: row.unlocked === 1,
    query: {
      taskId: row.taskId,
      tool: row.tool,
      inputKind: row.inputKind,
      rawInput: row.rawInput,
      normalizedInput: row.normalizedInput,
      createdAt: row.createdAt,
    },
    preview: {
      level: row.level,
      summary: row.summary,
      evidence: parseJsonField<unknown[]>(row.evidenceJson, []),
      recommendedActions: parseJsonField<string[]>(
        row.recommendedActionsJson,
        [],
      ),
      extra: parseJsonField<unknown | null>(row.extraJson, null),
    },
  };
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.get("/api/reports/:reportId", async (request, reply) => {
    const { reportId } = request.params as { reportId: string };
    const report = getReport(app, reportId);

    if (!report) {
      return reply.code(404).send({
        code: "REPORT_NOT_FOUND",
        message: "报告不存在",
      });
    }

    return serializeReport(report);
  });

  app.post("/api/reports/:reportId/unlock", async (request, reply) => {
    const { reportId } = request.params as { reportId: string };
    const report = getReport(app, reportId);

    if (!report) {
      return reply.code(404).send({
        code: "REPORT_NOT_FOUND",
        message: "报告不存在",
      });
    }

    const body = (request.body ?? {}) as UnlockReportBody;
    const email = body.email?.trim() || null;
    const phone = body.phone?.trim() || null;

    if (!email && !phone) {
      return reply.code(400).send({
        code: "CONTACT_REQUIRED",
        message: "请输入邮箱或手机号",
      });
    }

    app.db
      .prepare(
        `INSERT INTO leads (
          id, email, phone, source_report_id, source_task_id, source_tool, source_input, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        email,
        phone,
        reportId,
        report.taskId,
        report.tool,
        report.normalizedInput,
        new Date().toISOString(),
      );

    app.db
      .prepare("UPDATE reports SET unlocked = 1 WHERE id = ?")
      .run(reportId);

    return {
      id: reportId,
      unlocked: true,
      fullReportUrl: `/api/reports/${reportId}`,
    };
  });
}
