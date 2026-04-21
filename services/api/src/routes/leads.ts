import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

interface CreateLeadBody {
  email?: string;
  phone?: string;
  note?: string;
}

export async function registerLeadRoutes(app: FastifyInstance) {
  app.post("/api/leads", async (request, reply) => {
    const body = (request.body ?? {}) as CreateLeadBody;
    const lead = {
      id: randomUUID(),
      email: body.email ?? null,
      phone: body.phone ?? null,
      createdAt: new Date().toISOString(),
    };

    app.db
      .prepare(
        `INSERT INTO leads (
          id, email, phone, source_report_id, source_task_id, source_tool, source_input, created_at
        ) VALUES (
          @id, @email, @phone, null, null, null, null, @createdAt
        )`,
      )
      .run(lead);

    return reply.code(201).send(lead);
  });
}
