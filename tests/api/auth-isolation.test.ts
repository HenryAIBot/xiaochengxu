import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";
import { processQueryTask } from "../helpers/run-worker.js";

async function registerUser(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/anonymous",
  });
  return res.json() as { userId: string; token: string };
}

describe("per-user read isolation", () => {
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

  it("GET /api/query-tasks/:id returns 404 when querying another user's task", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    const aliceTask = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = aliceTask.json();

    const bobRead = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(bobRead.statusCode).toBe(404);

    const aliceRead = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(aliceRead.statusCode).toBe(200);
  });

  it("GET /api/monitors returns only the caller's monitors", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { targetKind: "brand", targetValue: "nike" },
    });
    await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${bob.token}` },
      payload: { targetKind: "brand", targetValue: "adidas" },
    });

    const aliceList = await app.inject({
      method: "GET",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    const bobList = await app.inject({
      method: "GET",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${bob.token}` },
    });

    const aliceItems = aliceList.json().items as Array<{ targetValue: string }>;
    const bobItems = bobList.json().items as Array<{ targetValue: string }>;
    expect(aliceItems.map((m) => m.targetValue)).toEqual(["nike"]);
    expect(bobItems.map((m) => m.targetValue)).toEqual(["adidas"]);
  });

  it("GET /api/reports/:id and unlock return 404 for other users", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = created.json();
    await processQueryTask(app, taskId);

    const aliceView = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    const reportId = aliceView.json().reportId as string;

    const bobGet = await app.inject({
      method: "GET",
      url: `/api/reports/${reportId}`,
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(bobGet.statusCode).toBe(404);

    const bobUnlock = await app.inject({
      method: "POST",
      url: `/api/reports/${reportId}/unlock`,
      headers: { Authorization: `Bearer ${bob.token}` },
      payload: { email: "bob@example.com" },
    });
    expect(bobUnlock.statusCode).toBe(404);

    const aliceGet = await app.inject({
      method: "GET",
      url: `/api/reports/${reportId}`,
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(aliceGet.statusCode).toBe(200);
  });

  it("GET /api/messages filters by owning monitor's user_id", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    const aliceMonitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { targetKind: "brand", targetValue: "nike" },
    });
    const bobMonitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${bob.token}` },
      payload: { targetKind: "brand", targetValue: "adidas" },
    });

    await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: {
        channel: "email",
        body: "alice notice",
        monitorId: aliceMonitor.json().id,
        level: "watch",
        to: "alice@example.com",
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: {
        channel: "email",
        body: "bob notice",
        monitorId: bobMonitor.json().id,
        level: "watch",
        to: "bob@example.com",
      },
    });

    const aliceList = await app.inject({
      method: "GET",
      url: "/api/messages",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    const bobList = await app.inject({
      method: "GET",
      url: "/api/messages",
      headers: { Authorization: `Bearer ${bob.token}` },
    });

    const aliceBodies = (aliceList.json() as Array<{ body: string }>).map(
      (m) => m.body,
    );
    const bobBodies = (bobList.json() as Array<{ body: string }>).map(
      (m) => m.body,
    );
    expect(aliceBodies).toEqual(["alice notice"]);
    expect(bobBodies).toEqual(["bob notice"]);
  });

  it("anonymous callers only see anonymous-owned data", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);

    // Alice's monitor (has user_id)
    await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { targetKind: "brand", targetValue: "nike" },
    });

    // Anonymous-created monitor (no user_id)
    await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: { targetKind: "brand", targetValue: "adidas" },
    });

    const anonList = await app.inject({ method: "GET", url: "/api/monitors" });
    const values = (
      anonList.json().items as Array<{ targetValue: string }>
    ).map((m) => m.targetValue);
    expect(values).toEqual(["adidas"]);
  });
});
