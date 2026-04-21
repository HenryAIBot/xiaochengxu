import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";

type MessageChannel = "email" | "sms" | "system";

interface CreateMessageBody {
  channel: MessageChannel;
  body: string;
  monitorId?: string | null;
  level?: string | null;
  to?: string | null;
}

const createMessageSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["channel", "body"],
    additionalProperties: false,
    properties: {
      channel: { type: "string", enum: ["email", "sms", "system"] },
      body: { type: "string", minLength: 1, maxLength: 4000 },
      monitorId: { type: ["string", "null"], maxLength: 64 },
      level: { type: ["string", "null"], maxLength: 32 },
      to: { type: ["string", "null"], maxLength: 200 },
    },
  },
};

export async function registerMessageRoutes(app: FastifyInstance) {
  app.get("/api/messages", async (request) => {
    const userId = request.user?.id ?? null;
    // Messages are scoped by the owning monitor's user_id. System messages with
    // monitor_id NULL, or messages for monitors that no longer exist, are treated
    // as "anonymous" and visible only to unauthenticated callers.
    const baseSelect = `SELECT m.id,
             m.channel,
             m.body,
             m.monitor_id AS monitorId,
             m.level,
             m.to_address AS toAddress,
             m.created_at AS createdAt
      FROM messages m
      LEFT JOIN monitors mo ON mo.id = m.monitor_id`;

    if (userId === null) {
      return app.db
        .prepare(
          `${baseSelect}
           WHERE mo.user_id IS NULL
           ORDER BY m.created_at DESC`,
        )
        .all();
    }

    return app.db
      .prepare(
        `${baseSelect}
         WHERE mo.user_id = ?
         ORDER BY m.created_at DESC`,
      )
      .all(userId);
  });

  app.post(
    "/api/messages",
    { schema: createMessageSchema },
    async (request, reply) => {
      const body = request.body as CreateMessageBody;

      const record = {
        id: randomUUID(),
        channel: body.channel,
        body: body.body,
        monitorId: body.monitorId ?? null,
        level: body.level ?? null,
        toAddress: body.to ?? null,
        createdAt: new Date().toISOString(),
      };

      app.db
        .prepare(
          `INSERT INTO messages (id, channel, body, monitor_id, level, to_address, created_at)
           VALUES (@id, @channel, @body, @monitorId, @level, @toAddress, @createdAt)`,
        )
        .run(record);

      return reply.code(201).send(record);
    },
  );
}
