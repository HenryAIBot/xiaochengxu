import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { redisConnectionOptions } from "./redis-options.js";

export type { Redis } from "ioredis";

export const QUEUE_NAMES = {
  query: "query-processing",
  monitor: "monitor-poll",
  notification: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function createRedisConnection(redisUrl?: string): Redis {
  return new Redis(
    redisUrl ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    redisConnectionOptions,
  );
}

export interface QueueClient {
  enqueueQuery(payload: { taskId: string }): Promise<void>;
  enqueueNotification(payload: {
    monitorId: string;
    notifyEmail?: string | null;
    notifyPhone?: string | null;
    preview: { level: string; summary: string };
  }): Promise<void>;
  enqueueAdvisorNotification(payload: {
    consultationId: string;
    advisorId: string;
    advisorName: string;
    advisorEmail: string | null;
    clientName: string;
    clientPhone: string;
    note: string | null;
    targetRef: { kind: string; value: string } | null;
    sourceReportId: string | null;
  }): Promise<void>;
  close(): Promise<void>;
}

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600, count: 500 },
} as const;

export function createQueueClient(
  opts: { redisUrl?: string } = {},
): QueueClient {
  const connection = createRedisConnection(opts.redisUrl);
  const queryQueue = new Queue(QUEUE_NAMES.query, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  const notificationQueue = new Queue(QUEUE_NAMES.notification, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  return {
    async enqueueQuery(payload) {
      await queryQueue.add("run", payload);
    },
    async enqueueNotification(payload) {
      await notificationQueue.add("notify", payload);
    },
    async enqueueAdvisorNotification(payload) {
      await notificationQueue.add("advisor-notify", payload);
    },
    async close() {
      await queryQueue.close();
      await notificationQueue.close();
      await connection.quit();
    },
  };
}
