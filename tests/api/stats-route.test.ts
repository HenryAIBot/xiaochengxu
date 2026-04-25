import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("GET /api/stats", () => {
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

  async function registerUser() {
    if (!app) throw new Error("app not built");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });
    return res.json() as { userId: string; token: string };
  }

  it("returns zeros when nothing exists", async () => {
    app = buildApp({ db });
    const user = await registerUser();
    const res = await app.inject({
      method: "GET",
      url: "/api/stats",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      activeMonitors: 0,
      detectionsThisWeek: 0,
      riskWarnings: 0,
      confirmedTro: 0,
    });
  });

  it("counts the caller's active monitors and recent detections", async () => {
    app = buildApp({ db });
    const alice = await registerUser();

    await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { targetKind: "brand", targetValue: "nike" },
    });
    await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { targetKind: "brand", targetValue: "apple" },
    });

    // Manually seed a query_task + report
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO query_tasks (id, tool, input_kind, raw_input, normalized_input, status, created_at, user_id)
       VALUES ('t1', 'infringement_check', 'brand', 'nike', 'nike', 'completed', ?, ?)`,
    ).run(now, alice.userId);
    db.prepare(
      `INSERT INTO reports (id, task_id, level, summary, evidence_json, recommended_actions_json, unlocked, created_at)
       VALUES ('r1', 't1', 'suspected_high', '…', '[]', '[]', 0, ?)`,
    ).run(now);

    const res = await app.inject({
      method: "GET",
      url: "/api/stats",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      activeMonitors: 2,
      detectionsThisWeek: 1,
      riskWarnings: 1,
      confirmedTro: 0,
    });
  });

  it("does not leak counts across users", async () => {
    app = buildApp({ db });
    const alice = await registerUser();
    const bob = await registerUser();

    await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { targetKind: "brand", targetValue: "nike" },
    });

    const bobStats = await app.inject({
      method: "GET",
      url: "/api/stats",
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(bobStats.json().activeMonitors).toBe(0);
  });
});
