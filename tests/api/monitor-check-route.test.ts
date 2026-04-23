import type { QueueClient } from "@xiaochengxu/queue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

function makeRecordingQueue() {
  const notifications: unknown[] = [];
  const client: QueueClient = {
    async enqueueQuery() {},
    async enqueueNotification(payload) {
      notifications.push(payload);
    },
    async enqueueAdvisorNotification() {},
    async listFailedNotifications() {
      return [];
    },
    async retryFailedNotification() {
      return { retried: false };
    },
    async close() {},
  };
  return { client, notifications };
}

async function createMonitor(
  app: ReturnType<typeof buildApp>,
  payload: {
    targetKind: "brand" | "asin" | "case_number" | "store_name";
    targetValue: string;
    notifyEmail?: string;
    notifyPhone?: string;
  },
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/monitors",
    payload,
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string };
}

describe("POST /api/internal/monitors/:id/check", () => {
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

  it("enqueues a notification when the monitor hits a new risk level", async () => {
    const { client, notifications } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    const monitor = await createMonitor(app, {
      targetKind: "brand",
      targetValue: "nike",
      notifyEmail: "seller@example.com",
      notifyPhone: "+8613800138000",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitor.id}/check`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      monitorId: monitor.id,
      triggered: true,
      dataSource: "fixture",
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      monitorId: monitor.id,
      notifyEmail: "seller@example.com",
      notifyPhone: "+8613800138000",
      preview: expect.objectContaining({ level: expect.any(String) }),
    });

    const row = db
      .prepare(
        "SELECT last_preview_level AS level, last_checked_at AS at FROM monitors WHERE id = ?",
      )
      .get(monitor.id) as { level: string; at: string };
    expect(row.level).not.toBe("clear");
    expect(row.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not enqueue a notification when level is unchanged", async () => {
    const { client, notifications } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    const monitor = await createMonitor(app, {
      targetKind: "brand",
      targetValue: "nike",
      notifyEmail: "seller@example.com",
    });

    await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitor.id}/check`,
    });
    expect(notifications).toHaveLength(1);

    const second = await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitor.id}/check`,
    });
    expect(second.json()).toMatchObject({ triggered: false });
    expect(notifications).toHaveLength(1);
  });

  it("skips inactive monitors", async () => {
    const { client, notifications } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    const monitor = await createMonitor(app, {
      targetKind: "brand",
      targetValue: "nike",
    });
    db.prepare("UPDATE monitors SET status = 'paused' WHERE id = ?").run(
      monitor.id,
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitor.id}/check`,
    });

    expect(res.json()).toMatchObject({ triggered: false });
    expect(notifications).toHaveLength(0);
  });

  it("returns 404 for unknown monitor", async () => {
    app = buildApp({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/internal/monitors/does-not-exist/check",
    });
    expect(res.statusCode).toBe(404);
  });

  it("does not enqueue when level is clear", async () => {
    const { client, notifications } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    // Use a brand that has no trademark hits → infringement_check returns clear
    const monitor = await createMonitor(app, {
      targetKind: "brand",
      targetValue: "abracadabrabogusbrand",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitor.id}/check`,
    });
    expect(res.json()).toMatchObject({ triggered: false, level: "clear" });
    expect(notifications).toHaveLength(0);
    // Silence unused var warning — monitor asserted alive above
    vi.fn(() => monitor.id);
  });
});
