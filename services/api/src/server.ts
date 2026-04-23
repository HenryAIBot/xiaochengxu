import { createQueueClient, createRedisConnection } from "@xiaochengxu/queue";
import { buildApp } from "./app.js";

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

  const app = buildApp({
    queue,
    internalToken,
    rateLimit: {
      max: rateLimitMax,
      timeWindow: rateLimitWindow,
      redis: rateLimitRedis,
    },
    wechat,
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
