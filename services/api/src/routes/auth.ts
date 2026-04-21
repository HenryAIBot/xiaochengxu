import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/anonymous", async (_request, reply) => {
    const user = {
      id: randomUUID(),
      token: randomBytes(24).toString("hex"),
      createdAt: new Date().toISOString(),
    };

    app.db
      .prepare(
        `INSERT INTO users (id, token, created_at, last_seen_at)
         VALUES (@id, @token, @createdAt, @createdAt)`,
      )
      .run(user);

    return reply.code(201).send({
      userId: user.id,
      token: user.token,
    });
  });
}
