import Fastify from "fastify";
import {
  type QueryTaskDatabase,
  createInMemoryDb,
  createQueryTaskDatabase,
} from "./lib/db.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerMonitorRoutes } from "./routes/monitors.js";
import { registerQueryTaskRoutes } from "./routes/query-tasks.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerStorefrontRoutes } from "./routes/storefronts.js";

declare module "fastify" {
  interface FastifyInstance {
    db: QueryTaskDatabase;
  }
}

export function buildApp({ db: providedDb }: { db?: QueryTaskDatabase } = {}) {
  const db = providedDb ?? createQueryTaskDatabase();
  const ownsDb = !providedDb;
  const app = Fastify();

  app.decorate("db", db);
  app.get("/health", async () => ({ ok: true }));
  app.register(registerQueryTaskRoutes);
  app.register(registerReportRoutes);
  app.register(registerMonitorRoutes);
  app.register(registerMessageRoutes);
  app.register(registerLeadRoutes);
  app.register(registerStorefrontRoutes);

  if (ownsDb) {
    app.addHook("onClose", async () => {
      db.close();
    });
  }

  return app;
}

export { createInMemoryDb, createQueryTaskDatabase } from "./lib/db.js";
