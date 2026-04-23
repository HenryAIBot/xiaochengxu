import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifySchema } from "fastify";

interface CreateLeadBody {
  email?: string;
  phone?: string;
  note?: string;
}

const createLeadSchema: FastifySchema = {
  body: {
    type: "object",
    additionalProperties: false,
    anyOf: [{ required: ["email"] }, { required: ["phone"] }],
    properties: {
      email: { type: "string", format: "email", maxLength: 200 },
      phone: { type: "string", pattern: "^\\+?\\d{7,15}$" },
      note: { type: "string", maxLength: 1000 },
    },
  },
};

export async function registerLeadRoutes(app: FastifyInstance) {
  app.post(
    "/api/leads",
    { schema: createLeadSchema },
    async (request, reply) => {
      const body = request.body as CreateLeadBody;
      const lead = {
        id: randomUUID(),
        email: body.email ?? null,
        phone: body.phone ?? null,
        createdAt: new Date().toISOString(),
        userId: request.user?.id ?? null,
      };

      await app.db
        .prepare(
          `INSERT INTO leads (
            id, email, phone, source_report_id, source_task_id, source_tool, source_input, created_at, user_id
          ) VALUES (
            @id, @email, @phone, null, null, null, null, @createdAt, @userId
          )`,
        )
        .run(lead);

      return reply.code(201).send({
        id: lead.id,
        email: lead.email,
        phone: lead.phone,
        createdAt: lead.createdAt,
      });
    },
  );
}
