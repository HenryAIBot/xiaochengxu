import rateLimit from "@fastify/rate-limit";
import type { QueueClient, Redis } from "@xiaochengxu/queue";
import Fastify from "fastify";
import { type DatabaseAdapter, SqliteAdapter } from "./lib/db-adapter.js";
import {
  createInMemoryAdapter,
  createInMemoryDb,
  createQueryTaskDatabase,
} from "./lib/db.js";
import { type ErrorReporter, stderrReporter } from "./lib/error-reporter.js";
import { type RequestUser, resolveRequestUser } from "./lib/user-identity.js";
import type { WeChatAuthConfig } from "./lib/wechat.js";
import {
  registerAdvisorRoutes,
  seedDefaultAdvisors,
} from "./routes/advisors.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerConsultationRoutes } from "./routes/consultations.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerMonitorRoutes } from "./routes/monitors.js";
import { registerQueryTaskRoutes } from "./routes/query-tasks.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerStorefrontRoutes } from "./routes/storefronts.js";

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseAdapter;
    queue: QueueClient;
    internalToken: string | null;
  }

  interface FastifyRequest {
    user: RequestUser | null;
  }
}

export interface BuildAppOptions {
  db?: DatabaseAdapter;
  queue?: QueueClient;
  internalToken?: string | null;
  /**
   * When set, applies global rate limiting per user/IP.
   * Pass `redis` to enable a shared store for multi-instance deployments;
   * omit for in-memory (dev / single instance).
   * Tests pass `null` or omit to disable.
   */
  rateLimit?: {
    max: number;
    timeWindow: number | string;
    redis?: Redis;
  } | null;
  /**
   * Optional hook called after every request; used for audit logging.
   * Defaults to a structured console.log in production; tests can inject
   * a spy or pass `null` to disable.
   */
  auditLog?: ((entry: AuditLogEntry) => void) | null;
  /**
   * WeChat auth configuration. When present, `POST /api/auth/wechat` will
   * exchange a wx.login code for an openid via jscode2session and return a
   * token. Pass `fetch` to stub the upstream call in tests.
   */
  wechat?: WeChatAuthConfig | null;
  /**
   * Reporter for uncaught request errors. Defaults to a structured-JSON
   * stderr writer. Wire in `createSentryReporter(Sentry, process.env.SENTRY_DSN)`
   * from `./lib/error-reporter.js` to ship to Sentry without coupling
   * this package to the Sentry SDK. Pass `null` to disable entirely.
   */
  errorReporter?: ErrorReporter | null;
}

export interface AuditLogEntry {
  at: string;
  method: string;
  url: string;
  statusCode: number;
  userId: string | null;
  durationMs: number;
}

export function createNoopQueueClient(): QueueClient {
  return {
    async enqueueQuery() {},
    async enqueueNotification() {},
    async enqueueAdvisorNotification() {},
    async close() {},
  };
}

export function buildApp(options: BuildAppOptions = {}) {
  // Synchronous buildApp — Postgres is opt-in via explicitly passed
  // `db: PostgresAdapter`. The default path stays on sqlite so tests
  // and single-instance dev remain zero-config.
  const db = options.db ?? new SqliteAdapter(createQueryTaskDatabase());
  const ownsDb = !options.db;
  const queue = options.queue ?? createNoopQueueClient();
  const internalToken =
    options.internalToken === undefined ? null : options.internalToken;
  const auditLog =
    options.auditLog === undefined
      ? (entry: AuditLogEntry) => {
          console.log(JSON.stringify({ kind: "audit", ...entry }));
        }
      : options.auditLog;
  const errorReporter =
    options.errorReporter === undefined
      ? stderrReporter
      : options.errorReporter;
  const app = Fastify();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, x-internal-token, Authorization",
    );
    if (request.method === "OPTIONS") {
      reply.code(204).send("");
    }
  });

  app.decorate("db", db);
  app.decorate("queue", queue);
  app.decorate("internalToken", internalToken);
  app.decorateRequest("user", null);

  if (options.rateLimit) {
    app.register(rateLimit, {
      global: true,
      max: options.rateLimit.max,
      timeWindow: options.rateLimit.timeWindow,
      redis: options.rateLimit.redis,
      keyGenerator: (request) => {
        const key = request.user?.id ?? request.ip;
        return typeof key === "string" && key.length > 0 ? key : "anonymous";
      },
    });
  }

  app.addHook("preHandler", async (request) => {
    request.user = await resolveRequestUser(db, request);
  });

  if (errorReporter) {
    app.addHook("onError", async (request, _reply, error) => {
      errorReporter({
        error,
        url: request.url,
        method: request.method,
        userId: request.user?.id ?? null,
      });
    });
  }

  if (auditLog) {
    app.addHook("onRequest", async (request) => {
      (request as unknown as { __startedAt?: number }).__startedAt = Date.now();
    });
    app.addHook("onResponse", async (request, reply) => {
      const startedAt =
        (request as unknown as { __startedAt?: number }).__startedAt ??
        Date.now();
      auditLog({
        at: new Date().toISOString(),
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        userId: request.user?.id ?? null,
        durationMs: Date.now() - startedAt,
      });
    });
  }

  app.get("/health", async () => ({ ok: true }));
  app.register(registerAuthRoutes({ wechat: options.wechat ?? null }));
  app.register(registerQueryTaskRoutes);
  app.register(registerInternalRoutes);
  app.register(registerReportRoutes);
  app.register(registerMonitorRoutes);
  app.register(registerMessageRoutes);
  app.register(registerLeadRoutes);
  app.register(registerStorefrontRoutes);
  app.register(registerConsultationRoutes);
  app.register(registerAdvisorRoutes);

  app.addHook("onReady", async () => {
    await seedDefaultAdvisors(db);
  });

  if (ownsDb) {
    app.addHook("onClose", async () => {
      await db.close();
    });
  }

  return app;
}

export {
  createDatabaseAdapter,
  createInMemoryAdapter,
  createInMemoryDb,
  createQueryTaskDatabase,
} from "./lib/db.js";
export { PostgresAdapter, SqliteAdapter } from "./lib/db-adapter.js";
