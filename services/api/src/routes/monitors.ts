import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

interface CreateMonitorBody {
  targetKind: "brand" | "store_name" | "asin";
  targetValue: string;
  notifyEmail?: string;
  notifyPhone?: string;
}

export async function registerMonitorRoutes(app: FastifyInstance) {
  app.post("/api/monitors", async (request, reply) => {
    const body = request.body as CreateMonitorBody;
    const monitor = {
      id: randomUUID(),
      targetKind: body.targetKind,
      targetValue: body.targetValue,
      notifyEmail: body.notifyEmail ?? null,
      notifyPhone: body.notifyPhone ?? null,
      status: "active" as const,
    };

    app.db
      .prepare(
        `INSERT INTO monitors (id, target_kind, target_value, notify_email, notify_phone, status)
         VALUES (@id, @targetKind, @targetValue, @notifyEmail, @notifyPhone, @status)`,
      )
      .run(monitor);

    return reply.code(201).send(monitor);
  });
}
