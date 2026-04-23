import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";

interface CreateMonitorBody {
  targetKind: "brand" | "store_name" | "asin" | "case_number";
  targetValue: string;
  notifyEmail?: string;
  notifyPhone?: string;
}

interface UpdateMonitorBody {
  status: "active" | "paused";
}

const updateMonitorSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["status"],
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["active", "paused"] },
    },
  },
};

const createMonitorSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["targetKind", "targetValue"],
    additionalProperties: false,
    properties: {
      targetKind: {
        type: "string",
        enum: ["brand", "store_name", "asin", "case_number"],
      },
      targetValue: { type: "string", minLength: 1, maxLength: 200 },
      notifyEmail: { type: "string", format: "email", maxLength: 200 },
      notifyPhone: {
        type: "string",
        pattern: "^\\+?\\d{7,15}$",
      },
    },
  },
};

export async function registerMonitorRoutes(app: FastifyInstance) {
  app.get("/api/monitors", async (request) => {
    const userId = request.user?.id ?? null;
    const whereClause = userId === null ? "user_id IS NULL" : "user_id = ?";
    const params = userId === null ? [] : [userId];
    // `rowid` is sqlite-specific; use created_at if available else id to keep
    // Postgres happy. Monitors don't have created_at yet — fall back to id.
    const orderColumn = app.db.dialect === "postgres" ? "id" : "rowid";
    const items = await app.db
      .prepare(
        `SELECT id,
                target_kind AS "targetKind",
                target_value AS "targetValue",
                notify_email AS "notifyEmail",
                notify_phone AS "notifyPhone",
                status
         FROM monitors
         WHERE ${whereClause}
         ORDER BY ${orderColumn} DESC`,
      )
      .all(...params);

    return { items };
  });

  app.post(
    "/api/monitors",
    { schema: createMonitorSchema },
    async (request, reply) => {
      const body = request.body as CreateMonitorBody;
      const monitor = {
        id: randomUUID(),
        targetKind: body.targetKind,
        targetValue: body.targetValue,
        notifyEmail: body.notifyEmail ?? null,
        notifyPhone: body.notifyPhone ?? null,
        status: "active" as const,
        userId: request.user?.id ?? null,
      };

      await app.db
        .prepare(
          `INSERT INTO monitors (id, target_kind, target_value, notify_email, notify_phone, status, user_id)
           VALUES (@id, @targetKind, @targetValue, @notifyEmail, @notifyPhone, @status, @userId)`,
        )
        .run(monitor);

      return reply.code(201).send({
        id: monitor.id,
        targetKind: monitor.targetKind,
        targetValue: monitor.targetValue,
        notifyEmail: monitor.notifyEmail,
        notifyPhone: monitor.notifyPhone,
        status: monitor.status,
      });
    },
  );

  app.patch(
    "/api/monitors/:id",
    { schema: updateMonitorSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user?.id ?? null;
      const row = await app.db
        .prepare('SELECT id, user_id AS "userId" FROM monitors WHERE id = ?')
        .get<{ id: string; userId: string | null }>(id);
      if (!row || row.userId !== userId) {
        return reply.code(404).send({ error: "monitor not found" });
      }
      const { status } = request.body as UpdateMonitorBody;
      await app.db
        .prepare("UPDATE monitors SET status = ? WHERE id = ?")
        .run(status, id);
      return reply.code(200).send({ id, status });
    },
  );

  app.delete("/api/monitors/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.id ?? null;
    const row = await app.db
      .prepare('SELECT id, user_id AS "userId" FROM monitors WHERE id = ?')
      .get<{ id: string; userId: string | null }>(id);
    if (!row || row.userId !== userId) {
      return reply.code(404).send({ error: "monitor not found" });
    }
    await app.db.prepare("DELETE FROM monitors WHERE id = ?").run(id);
    return reply.code(204).send();
  });
}
