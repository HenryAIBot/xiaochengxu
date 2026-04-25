import {
  DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
  createRedisConnection,
} from "@xiaochengxu/queue";
import { createDefaultToolExecutor, loadRootEnv } from "@xiaochengxu/tools";
import { Queue, Worker } from "bullmq";
import {
  type AdvisorNotificationJob,
  runAdvisorNotificationProcessor,
} from "./processors/advisor-notification-processor.js";
import { runMonitorProcessor } from "./processors/monitor-processor.js";
import {
  type MonitorSummary,
  runMonitorTickProcessor,
} from "./processors/monitor-tick-processor.js";
import {
  type QueryTaskRawRecord,
  runQueryTaskProcessor,
} from "./processors/query-task-processor.js";
import { sendEmail } from "./providers/email-provider.js";
import { sendSms } from "./providers/sms-provider.js";

loadRootEnv();

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";
const MONITOR_TICK_INTERVAL_MS = Number(
  process.env.MONITOR_TICK_INTERVAL_MS ?? 300_000,
);
const runTool = createDefaultToolExecutor();

async function fetchJson(
  path: string,
  init?: { method?: string; body?: unknown },
) {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (path.startsWith("/api/internal/") && INTERNAL_API_TOKEN) {
    headers["x-internal-token"] = INTERNAL_API_TOKEN;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `${init?.method ?? "GET"} ${path} failed: ${response.status} ${response.statusText} ${detail}`,
    );
  }

  return response.json();
}

async function loadTask(taskId: string): Promise<QueryTaskRawRecord> {
  return (await fetchJson(
    `/api/internal/query-tasks/${taskId}/raw`,
  )) as QueryTaskRawRecord;
}

async function saveMessageViaApi(input: {
  monitorId: string;
  level: string;
  channel: "email" | "sms" | "system";
  to: string | null;
  body: string;
}) {
  return fetchJson("/api/messages", { method: "POST", body: input });
}

const queryConnection = createRedisConnection();
const notificationConnection = createRedisConnection();
const monitorConnection = createRedisConnection();
const monitorSchedulerConnection = createRedisConnection();

new Worker(
  QUEUE_NAMES.query,
  async (job) =>
    runQueryTaskProcessor(job.data, {
      loadTask,
      runTool: (task) =>
        runTool({
          tool: task.tool,
          normalizedInput: task.normalizedInput,
        }),
      postResult: (taskId, result) =>
        fetchJson(`/api/internal/query-tasks/${taskId}/result`, {
          method: "POST",
          body: { report: result },
        }) as Promise<unknown> as Promise<void>,
      postFailure: (taskId, error) =>
        fetchJson(`/api/internal/query-tasks/${taskId}/result`, {
          method: "POST",
          body: { error },
        }) as Promise<unknown> as Promise<void>,
    }),
  { connection: queryConnection },
);

const notificationWorker = new Worker(
  QUEUE_NAMES.notification,
  async (job) => {
    if (job.name === "advisor-notify") {
      return runAdvisorNotificationProcessor(
        job.data as AdvisorNotificationJob,
        {
          sendEmail,
        },
      );
    }
    return runMonitorProcessor(job.data, {
      sendEmail,
      sendSms,
      saveMessage: saveMessageViaApi,
    });
  },
  { connection: notificationConnection },
);

notificationWorker.on("failed", (job, err) => {
  if (!job) return;
  const attempts = job.attemptsMade ?? 0;
  const maxAttempts = job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts;
  const terminal = attempts >= maxAttempts;
  console.error(
    `[jobs] notification ${job.name} jobId=${job.id} ${terminal ? "DLQ" : "retry"} attempt=${attempts}/${maxAttempts} reason=${err.message}`,
  );
});

new Worker(
  QUEUE_NAMES.monitor,
  async () =>
    runMonitorTickProcessor({
      listMonitors: () =>
        fetchJson("/api/internal/monitors/due") as Promise<{
          items: MonitorSummary[];
        }>,
      checkMonitor: (id) =>
        fetchJson(`/api/internal/monitors/${id}/check`, {
          method: "POST",
        }) as Promise<{ triggered: boolean }>,
    }),
  { connection: monitorConnection },
);

const monitorQueue = new Queue(QUEUE_NAMES.monitor, {
  connection: monitorSchedulerConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

const MONITOR_TICK_JOB_ID = "monitor-tick";
await monitorQueue
  .upsertJobScheduler(
    MONITOR_TICK_JOB_ID,
    { every: MONITOR_TICK_INTERVAL_MS },
    { name: "monitor-tick", data: {} },
  )
  .catch((error) => {
    console.error(
      `[jobs] failed to schedule monitor-tick: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

console.log(
  `[jobs] monitor-tick scheduled every ${MONITOR_TICK_INTERVAL_MS}ms against ${API_BASE_URL}`,
);
