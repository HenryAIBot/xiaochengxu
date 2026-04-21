import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { redisConnectionOptions } from "./redis-options.js";

const connection = new Redis(
  process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  redisConnectionOptions,
);

export const queryQueue = new Queue("query-processing", { connection });
export const monitorQueue = new Queue("monitor-poll", { connection });
export const notificationQueue = new Queue("notifications", { connection });
