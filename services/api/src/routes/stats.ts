import type { FastifyInstance } from "fastify";

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get("/api/stats", async (request) => {
    const userId = request.user?.id ?? null;
    const where = userId === null ? "IS NULL" : "= ?";
    const bind = userId === null ? [] : [userId];

    // Postgres uses TIMESTAMPTZ arithmetic; sqlite stores ISO strings —
    // compute the "7 days ago" cutoff in JS and pass as parameter.
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const active = await app.db
      .prepare(
        `SELECT COUNT(*) AS c FROM monitors WHERE status = 'active' AND user_id ${where}`,
      )
      .get<{ c: number | string }>(...bind);

    const thisWeek = await app.db
      .prepare(
        `SELECT COUNT(*) AS c FROM query_tasks WHERE created_at >= ? AND user_id ${where}`,
      )
      .get<{ c: number | string }>(weekAgo, ...bind);

    // Risk warnings = reports with level != 'clear' for the user's tasks this week
    const warnings = await app.db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM reports r
         JOIN query_tasks t ON t.id = r.task_id
         WHERE r.level != 'clear' AND t.user_id ${where} AND r.created_at >= ?`,
      )
      .get<{ c: number | string }>(...bind, weekAgo);

    const confirmed = await app.db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM reports r
         JOIN query_tasks t ON t.id = r.task_id
         WHERE r.level = 'confirmed' AND t.user_id ${where}`,
      )
      .get<{ c: number | string }>(...bind);

    return {
      activeMonitors: Number(active?.c ?? 0),
      detectionsThisWeek: Number(thisWeek?.c ?? 0),
      riskWarnings: Number(warnings?.c ?? 0),
      confirmedTro: Number(confirmed?.c ?? 0),
    };
  });
}
