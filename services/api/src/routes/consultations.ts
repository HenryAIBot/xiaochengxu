import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";

interface CreateConsultationBody {
  name: string;
  phone: string;
  note?: string;
}

const createConsultationSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["name", "phone"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60 },
      phone: { type: "string", pattern: "^\\+?\\d{7,15}$" },
      note: { type: "string", maxLength: 1000 },
    },
  },
};

export async function registerConsultationRoutes(app: FastifyInstance) {
  app.post(
    "/api/consultations",
    { schema: createConsultationSchema },
    async (request, reply) => {
      const body = request.body as CreateConsultationBody;
      const now = new Date().toISOString();
      const record = {
        id: randomUUID(),
        userId: request.user?.id ?? null,
        name: body.name,
        phone: body.phone,
        note: body.note ?? null,
        status: "pending" as const,
        createdAt: now,
      };

      app.db
        .prepare(
          `INSERT INTO consultations (id, user_id, name, phone, note, status, created_at, updated_at)
           VALUES (@id, @userId, @name, @phone, @note, @status, @createdAt, @createdAt)`,
        )
        .run(record);

      return reply.code(201).send({
        id: record.id,
        name: record.name,
        phone: record.phone,
        note: record.note,
        status: record.status,
        createdAt: record.createdAt,
      });
    },
  );

  app.get("/api/consultations", async (request) => {
    const userId = request.user?.id ?? null;
    const whereClause = userId === null ? "user_id IS NULL" : "user_id = ?";
    const params = userId === null ? [] : [userId];
    const items = app.db
      .prepare(
        `SELECT id, name, phone, note, status, advisor,
                created_at AS createdAt, updated_at AS updatedAt
         FROM consultations
         WHERE ${whereClause}
         ORDER BY created_at DESC`,
      )
      .all(...params);
    return { items };
  });
}
