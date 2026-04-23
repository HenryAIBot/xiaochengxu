import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("GET /api/internal/monitors/due", () => {
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

  async function seedMonitor(opts: {
    id: string;
    status?: string;
    tickIntervalSeconds?: number | null;
    lastCheckedAt?: string | null;
  }) {
    db.prepare(
      `INSERT INTO monitors (id, target_kind, target_value, status, user_id, tick_interval_seconds, last_checked_at)
       VALUES (?, 'brand', 'nike', ?, NULL, ?, ?)`,
    ).run(
      opts.id,
      opts.status ?? "active",
      opts.tickIntervalSeconds ?? null,
      opts.lastCheckedAt ?? null,
    );
  }

  it("returns monitors never checked before", async () => {
    app = buildApp({ db });
    await seedMonitor({ id: "m1", lastCheckedAt: null });

    const res = await app.inject({
      method: "GET",
      url: "/api/internal/monitors/due",
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toContain("m1");
  });

  it("excludes monitors still within their tickIntervalSeconds", async () => {
    app = buildApp({ db });
    const recent = new Date(Date.now() - 5 * 1000).toISOString();
    await seedMonitor({
      id: "m1",
      tickIntervalSeconds: 60,
      lastCheckedAt: recent,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/internal/monitors/due",
    });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).not.toContain("m1");
  });

  it("includes monitors past their tickIntervalSeconds", async () => {
    app = buildApp({ db });
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await seedMonitor({
      id: "m1",
      tickIntervalSeconds: 300,
      lastCheckedAt: old,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/internal/monitors/due",
    });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toContain("m1");
  });

  it("excludes paused monitors", async () => {
    app = buildApp({ db });
    await seedMonitor({ id: "m1", status: "paused", lastCheckedAt: null });

    const res = await app.inject({
      method: "GET",
      url: "/api/internal/monitors/due",
    });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).not.toContain("m1");
  });
});
