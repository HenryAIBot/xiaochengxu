import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("internal endpoint authentication", () => {
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

  async function seedTaskId() {
    if (!app) throw new Error("app not built");
    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });
    return created.json().taskId as string;
  }

  it("allows internal calls when no token is configured (dev default)", async () => {
    app = buildApp({ db, internalToken: null });
    const taskId = await seedTaskId();

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/query-tasks/${taskId}/result`,
      payload: { error: "x" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("allows internal calls when token matches", async () => {
    app = buildApp({ db, internalToken: "shh-secret" });
    const taskId = await seedTaskId();

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/query-tasks/${taskId}/result`,
      headers: { "x-internal-token": "shh-secret" },
      payload: { error: "x" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects internal calls when token is missing", async () => {
    app = buildApp({ db, internalToken: "shh-secret" });
    const taskId = await seedTaskId();

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/query-tasks/${taskId}/result`,
      payload: { error: "x" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("rejects internal calls when token is wrong", async () => {
    app = buildApp({ db, internalToken: "shh-secret" });
    const taskId = await seedTaskId();

    const res = await app.inject({
      method: "POST",
      url: `/api/internal/query-tasks/${taskId}/result`,
      headers: { "x-internal-token": "wrong" },
      payload: { error: "x" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("does not block non-internal routes when token is set", async () => {
    app = buildApp({ db, internalToken: "shh-secret" });

    const res = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });
    expect(res.statusCode).toBe(202);
  });

  it("also protects the raw query-task metadata endpoint", async () => {
    app = buildApp({ db, internalToken: "shh-secret" });
    const taskId = await seedTaskId();

    const blocked = await app.inject({
      method: "GET",
      url: `/api/internal/query-tasks/${taskId}/raw`,
    });
    expect(blocked.statusCode).toBe(401);

    const allowed = await app.inject({
      method: "GET",
      url: `/api/internal/query-tasks/${taskId}/raw`,
      headers: { "x-internal-token": "shh-secret" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().taskId).toBe(taskId);
  });

  it("also protects monitor check endpoint", async () => {
    app = buildApp({ db, internalToken: "shh-secret" });
    const monitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: { targetKind: "brand", targetValue: "nike" },
    });
    const monitorId = monitor.json().id as string;

    const blocked = await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitorId}/check`,
    });
    expect(blocked.statusCode).toBe(401);

    const allowed = await app.inject({
      method: "POST",
      url: `/api/internal/monitors/${monitorId}/check`,
      headers: { "x-internal-token": "shh-secret" },
    });
    expect(allowed.statusCode).toBe(200);
  });
});
