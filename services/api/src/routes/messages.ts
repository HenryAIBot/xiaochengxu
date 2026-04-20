import type { FastifyInstance } from "fastify";

export async function registerMessageRoutes(app: FastifyInstance) {
  app.get("/api/messages", async () => {
    return app.db
      .prepare(
        "SELECT id, channel, body, created_at AS createdAt FROM messages ORDER BY created_at DESC",
      )
      .all();
  });
}
