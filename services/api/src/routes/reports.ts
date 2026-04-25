import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";

interface UnlockReportBody {
  email?: string;
  phone?: string;
}

const unlockReportSchema: FastifySchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email", maxLength: 200 },
      phone: { type: "string", pattern: "^\\+?\\d{7,15}$" },
    },
    // No `required` — either (or both) can be supplied. Empty bodies
    // land at the CONTACT_REQUIRED business error below.
  },
};

interface StoredReportRow {
  id: string;
  taskId: string;
  level: string;
  summary: string;
  evidenceJson: unknown;
  recommendedActionsJson: unknown;
  extraJson: unknown;
  unlocked: number | boolean;
  tool: string;
  inputKind: string;
  rawInput: string;
  normalizedInput: string;
  createdAt: string;
  taskUserId: string | null;
  dataSource: string | null;
  reportCreatedAt: string | null;
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function fetchReport(app: FastifyInstance, reportId: string) {
  return app.db
    .prepare(
      `SELECT reports.id,
              reports.task_id AS "taskId",
              reports.level,
              reports.summary,
              reports.evidence_json AS "evidenceJson",
              reports.recommended_actions_json AS "recommendedActionsJson",
              reports.extra_json AS "extraJson",
              reports.unlocked,
              query_tasks.tool,
              query_tasks.input_kind AS "inputKind",
              query_tasks.raw_input AS "rawInput",
              query_tasks.normalized_input AS "normalizedInput",
              query_tasks.created_at AS "createdAt",
              query_tasks.user_id AS "taskUserId",
              reports.data_source AS "dataSource",
              reports.created_at AS "reportCreatedAt"
       FROM reports
       INNER JOIN query_tasks ON query_tasks.id = reports.task_id
       WHERE reports.id = ?`,
    )
    .get<StoredReportRow>(reportId);
}

function canAccessReport(
  report: StoredReportRow | undefined,
  userId: string | null,
): report is StoredReportRow {
  return !!report && report.taskUserId === userId;
}

function isUnlocked(value: number | boolean): boolean {
  return value === true || value === 1;
}

function serializeReport(row: StoredReportRow) {
  return {
    id: row.id,
    unlocked: isUnlocked(row.unlocked),
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
      dataSource: row.dataSource ?? "fixture",
      reportCreatedAt: row.reportCreatedAt,
    },
  };
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.get("/api/reports/:reportId", async (request, reply) => {
    const { reportId } = request.params as { reportId: string };
    const report = await fetchReport(app, reportId);
    const userId = request.user?.id ?? null;

    if (!canAccessReport(report, userId)) {
      return reply.code(404).send({
        code: "REPORT_NOT_FOUND",
        message: "报告不存在",
      });
    }

    return serializeReport(report);
  });

  app.post(
    "/api/reports/:reportId/unlock",
    {
      schema: unlockReportSchema,
      config: app.rateLimits.unlockReport
        ? { rateLimit: app.rateLimits.unlockReport }
        : undefined,
    },
    async (request, reply) => {
      const { reportId } = request.params as { reportId: string };
      const report = await fetchReport(app, reportId);
      const userId = request.user?.id ?? null;

      if (!canAccessReport(report, userId)) {
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

      await app.db
        .prepare(
          `INSERT INTO leads (
          id, email, phone, source_report_id, source_task_id, source_tool, source_input, created_at, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          request.user?.id ?? null,
        );

      const unlockedValue = app.db.dialect === "postgres" ? true : 1;
      await app.db
        .prepare("UPDATE reports SET unlocked = ? WHERE id = ?")
        .run(unlockedValue, reportId);

      return {
        id: reportId,
        unlocked: true,
        fullReportUrl: `/api/reports/${reportId}`,
      };
    },
  );
}
