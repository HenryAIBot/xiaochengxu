import { createQueueClient, createRedisConnection } from "@xiaochengxu/queue";
import { buildApp } from "./app.js";
import { type ErrorReporter, stderrReporter } from "./lib/error-reporter.js";

/**
 * Build a Sentry reporter if `@sentry/node` is installed *and* SENTRY_DSN
 * is set. The dynamic import keeps the SDK optional: if nobody runs
 * `pnpm add @sentry/node` it simply falls back to stderr logging.
 */
async function buildProductionReporter(): Promise<ErrorReporter> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return stderrReporter;
  try {
    const Sentry = (await import(
      /* @vite-ignore */ "@sentry/node" as string
    )) as {
      init: (opts: { dsn: string }) => void;
      captureException: Parameters<
        typeof import("./lib/error-reporter.js").createSentryReporter
      >[0]["captureException"];
    };
    Sentry.init({ dsn });
    const { createSentryReporter } = await import("./lib/error-reporter.js");
    return createSentryReporter(Sentry, dsn);
  } catch {
    console.warn(
      "[api] SENTRY_DSN is set but @sentry/node is not installed — falling back to stderr error reporting.",
    );
    return stderrReporter;
  }
}

async function main() {
  const queue = createQueueClient();
  const internalToken = process.env.INTERNAL_API_TOKEN ?? null;
  if (!internalToken) {
    console.warn(
      "[api] INTERNAL_API_TOKEN is not set — /api/internal/* endpoints are UNAUTHENTICATED. Set INTERNAL_API_TOKEN before production.",
    );
  }
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 60);
  const rateLimitWindow = process.env.RATE_LIMIT_WINDOW ?? "1 minute";
  const rateLimitRedis = process.env.RATE_LIMIT_REDIS_URL
    ? createRedisConnection(process.env.RATE_LIMIT_REDIS_URL)
    : undefined;

  const wechatAppId = process.env.WECHAT_APPID;
  const wechatAppSecret = process.env.WECHAT_SECRET;
  const wechat =
    wechatAppId && wechatAppSecret
      ? {
          appId: wechatAppId,
          appSecret: wechatAppSecret,
          endpoint: process.env.WECHAT_JSCODE2SESSION_URL,
        }
      : null;
  if (!wechat) {
    console.warn(
      "[api] WECHAT_APPID / WECHAT_SECRET not set — /api/auth/wechat will return 503. Anonymous auth still works.",
    );
  }

  const errorReporter = await buildProductionReporter();

  const app = buildApp({
    queue,
    internalToken,
    rateLimit: {
      max: rateLimitMax,
      timeWindow: rateLimitWindow,
      redis: rateLimitRedis,
    },
    wechat,
    errorReporter,
  });

  try {
    await app.listen({
      port: Number(process.env.API_PORT ?? 3000),
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await queue.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
