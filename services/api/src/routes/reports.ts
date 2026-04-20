import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

interface UnlockReportBody {
  email?: string;
  phone?: string;
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.post("/api/reports/:reportId/unlock", async (request) => {
    const { reportId } = request.params as { reportId: string };
    const body = (request.body ?? {}) as UnlockReportBody;

    app.db
      .prepare(
        "INSERT INTO leads (id, email, phone, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        body.email ?? null,
        body.phone ?? null,
        new Date().toISOString(),
      );

    return {
      id: reportId,
      unlocked: true,
      fullReportUrl: `/api/reports/${reportId}`,
    };
  });
}
