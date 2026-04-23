import { randomUUID } from "node:crypto";
import {
  type MonitorTargetKind,
  createDefaultMonitorChecker,
} from "@xiaochengxu/tools";
import type { FastifyInstance } from "fastify";

interface WorkerResultBody {
  report?: {
    level: string;
    summary: string;
    evidence: unknown[];
    recommendedActions: string[];
    extra?: unknown;
    dataSource?: string;
    sourceFetchedAt?: string;
  };
  error?: string;
}

interface MonitorRow {
  id: string;
  targetKind: MonitorTargetKind;
  targetValue: string;
  notifyEmail: string | null;
  notifyPhone: string | null;
  status: string;
  lastPreviewLevel: string | null;
}

export async function registerInternalRoutes(app: FastifyInstance) {
  const runMonitorCheck = createDefaultMonitorChecker();

  app.addHook("preHandler", async (request, reply) => {
    const expected = app.internalToken;
    if (expected === null || expected === "") {
      return;
    }
    const provided = request.headers["x-internal-token"];
    if (provided !== expected) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/internal/query-tasks/:taskId/raw", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const row = await app.db
      .prepare(
        `SELECT id, tool, input_kind AS "inputKind", raw_input AS "rawInput",
                normalized_input AS "normalizedInput", status, created_at AS "createdAt"
         FROM query_tasks WHERE id = ?`,
      )
      .get<{
        id: string;
        tool: string;
        inputKind: string;
        rawInput: string;
        normalizedInput: string;
        status: string;
        createdAt: string;
      }>(taskId);
    if (!row) {
      return reply.code(404).send({ error: "task not found" });
    }
    return {
      taskId: row.id,
      tool: row.tool,
      status: row.status,
      normalizedInput: {
        kind: row.inputKind,
        rawValue: row.rawInput,
        normalizedValue: row.normalizedInput,
      },
    };
  });

  app.post(
    "/api/internal/query-tasks/:taskId/result",
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const body = request.body as WorkerResultBody | undefined;

      const task = await app.db
        .prepare("SELECT id, status FROM query_tasks WHERE id = ?")
        .get<{ id: string; status: string }>(taskId);

      if (!task) {
        return reply.code(404).send({ error: "task not found" });
      }

      const now = new Date().toISOString();

      if (body?.error) {
        await app.db
          .prepare(
            "UPDATE query_tasks SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?",
          )
          .run(body.error, now, taskId);
        return reply.code(200).send({ taskId, status: "failed" });
      }

      if (!body?.report) {
        return reply.code(400).send({ error: "report or error is required" });
      }

      const report = body.report;
      const reportId = randomUUID();
      const unlocked = app.db.dialect === "postgres" ? false : 0;

      await app.db
        .prepare(
          `INSERT INTO reports (
            id, task_id, level, summary, evidence_json,
            recommended_actions_json, extra_json, unlocked,
            data_source, created_at, source_fetched_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          reportId,
          taskId,
          report.level,
          report.summary,
          JSON.stringify(report.evidence ?? []),
          JSON.stringify(report.recommendedActions ?? []),
          report.extra ? JSON.stringify(report.extra) : null,
          unlocked,
          report.dataSource ?? "fixture",
          now,
          report.sourceFetchedAt ?? now,
        );

      await app.db
        .prepare(
          "UPDATE query_tasks SET status = 'completed', updated_at = ? WHERE id = ?",
        )
        .run(now, taskId);

      return reply.code(200).send({ taskId, status: "completed", reportId });
    },
  );

  app.get("/api/internal/notifications/failed", async (request) => {
    const url = new URL(request.url, "http://placeholder");
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(500, Math.max(1, Number(limitRaw))) : 50;
    const items = await app.queue.listFailedNotifications(limit);
    return { items };
  });

  app.post(
    "/api/internal/notifications/failed/:jobId/retry",
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const result = await app.queue.retryFailedNotification(jobId);
      if (!result.retried) {
        return reply.code(404).send({ error: "failed job not found" });
      }
      return { jobId, retried: true };
    },
  );

  app.get("/api/internal/monitors/due", async () => {
    const globalDefault = Number(
      process.env.MONITOR_TICK_INTERVAL_MS ?? 300_000,
    );
    const rows = await app.db
      .prepare(
        `SELECT id,
                status,
                tick_interval_seconds AS "tickIntervalSeconds",
                last_checked_at AS "lastCheckedAt"
         FROM monitors
         WHERE status = 'active'`,
      )
      .all<{
        id: string;
        status: string;
        tickIntervalSeconds: number | null;
        lastCheckedAt: string | null;
      }>();

    const now = Date.now();
    const items = rows.filter((row) => {
      if (!row.lastCheckedAt) return true;
      const intervalMs =
        (row.tickIntervalSeconds ?? Math.floor(globalDefault / 1000)) * 1000;
      const last = new Date(row.lastCheckedAt).getTime();
      return Number.isFinite(last) && now - last >= intervalMs;
    });

    return {
      items: items.map((row) => ({ id: row.id, status: row.status })),
    };
  });

  app.post(
    "/api/internal/monitors/:monitorId/check",
    async (request, reply) => {
      const { monitorId } = request.params as { monitorId: string };
      const monitor = await app.db
        .prepare(
          `SELECT id,
                  target_kind AS "targetKind",
                  target_value AS "targetValue",
                  notify_email AS "notifyEmail",
                  notify_phone AS "notifyPhone",
                  status,
                  last_preview_level AS "lastPreviewLevel"
           FROM monitors WHERE id = ?`,
        )
        .get<MonitorRow>(monitorId);

      if (!monitor) {
        return reply.code(404).send({ error: "monitor not found" });
      }

      if (monitor.status !== "active") {
        return reply.code(200).send({
          monitorId,
          triggered: false,
          reason: "monitor is not active",
        });
      }

      const check = await runMonitorCheck({
        targetKind: monitor.targetKind,
        targetValue: monitor.targetValue,
      });

      const now = new Date().toISOString();
      await app.db
        .prepare(
          `UPDATE monitors
           SET last_preview_level = ?, last_preview_summary = ?, last_checked_at = ?
           WHERE id = ?`,
        )
        .run(check.level, check.summary, now, monitorId);

      const shouldNotify =
        check.level !== "clear" && check.level !== monitor.lastPreviewLevel;

      if (shouldNotify) {
        await app.queue.enqueueNotification({
          monitorId,
          notifyEmail: monitor.notifyEmail,
          notifyPhone: monitor.notifyPhone,
          preview: { level: check.level, summary: check.summary },
        });
      }

      return reply.code(200).send({
        monitorId,
        triggered: shouldNotify,
        level: check.level,
        summary: check.summary,
        dataSource: check.dataSource,
      });
    },
  );
}
