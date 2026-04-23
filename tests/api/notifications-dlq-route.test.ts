import type { FailedNotification, QueueClient } from "@xiaochengxu/queue";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

function makeQueueWithFailed(
  failed: FailedNotification[],
  retryable: Set<string> = new Set(),
): QueueClient {
  return {
    async enqueueQuery() {},
    async enqueueNotification() {},
    async enqueueAdvisorNotification() {},
    async listFailedNotifications(limit) {
      return failed.slice(0, limit ?? failed.length);
    },
    async retryFailedNotification(jobId) {
      return { retried: retryable.has(jobId) };
    },
    async close() {},
  };
}

describe("notifications DLQ internal routes", () => {
  let db = createInMemoryDb();
  let app: ReturnType<typeof buildApp> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    db.close();
    db = createInMemoryDb();
  });

  it("GET /api/internal/notifications/failed returns failed jobs", async () => {
    const queue = makeQueueWithFailed([
      {
        jobId: "j1",
        name: "notify",
        data: { monitorId: "m1" },
        failedReason: "smtp timeout",
        attemptsMade: 3,
        failedAt: 1_700_000_000_000,
      },
    ]);
    app = buildApp({ db, queue });

    const res = await app.inject({
      method: "GET",
      url: "/api/internal/notifications/failed",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      jobId: "j1",
      name: "notify",
      failedReason: "smtp timeout",
      attemptsMade: 3,
    });
  });

  it("POST /api/internal/notifications/failed/:jobId/retry returns 200 when retried", async () => {
    const queue = makeQueueWithFailed([], new Set(["j1"]));
    app = buildApp({ db, queue });

    const res = await app.inject({
      method: "POST",
      url: "/api/internal/notifications/failed/j1/retry",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ jobId: "j1", retried: true });
  });

  it("POST /api/internal/notifications/failed/:jobId/retry returns 404 when not found", async () => {
    const queue = makeQueueWithFailed([]);
    app = buildApp({ db, queue });

    const res = await app.inject({
      method: "POST",
      url: "/api/internal/notifications/failed/missing/retry",
    });
    expect(res.statusCode).toBe(404);
  });
});
