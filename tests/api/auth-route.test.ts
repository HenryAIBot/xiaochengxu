import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("POST /api/auth/anonymous", () => {
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

  it("creates an anonymous user and returns userId + token", async () => {
    app = buildApp({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.userId).toEqual(expect.any(String));
    expect(body.token).toMatch(/^[0-9a-f]{48}$/);

    const row = db
      .prepare("SELECT id, token FROM users WHERE id = ?")
      .get(body.userId) as { id: string; token: string };
    expect(row.token).toBe(body.token);
  });

  it("assigns user_id to query_tasks / monitors / leads when Authorization is valid", async () => {
    app = buildApp({ db });
    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });
    const { userId, token } = auth.json();

    const query = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      headers: { Authorization: `Bearer ${token}` },
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = query.json();
    const taskRow = db
      .prepare("SELECT user_id AS userId FROM query_tasks WHERE id = ?")
      .get(taskId) as { userId: string };
    expect(taskRow.userId).toBe(userId);

    const monitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${token}` },
      payload: { targetKind: "brand", targetValue: "nike" },
    });
    const monitorRow = db
      .prepare("SELECT user_id AS userId FROM monitors WHERE id = ?")
      .get(monitor.json().id) as { userId: string };
    expect(monitorRow.userId).toBe(userId);

    const lead = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: "seller@example.com" },
    });
    const leadRow = db
      .prepare("SELECT user_id AS userId FROM leads WHERE id = ?")
      .get(lead.json().id) as { userId: string };
    expect(leadRow.userId).toBe(userId);
  });

  it("stores null user_id when Authorization is missing", async () => {
    app = buildApp({ db });
    const query = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = query.json();
    const row = db
      .prepare("SELECT user_id AS userId FROM query_tasks WHERE id = ?")
      .get(taskId) as { userId: string | null };
    expect(row.userId).toBeNull();
  });

  it("ignores invalid tokens (request.user = null)", async () => {
    app = buildApp({ db });
    const query = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      headers: { Authorization: "Bearer no-such-token" },
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = query.json();
    const row = db
      .prepare("SELECT user_id AS userId FROM query_tasks WHERE id = ?")
      .get(taskId) as { userId: string | null };
    expect(row.userId).toBeNull();
  });

  it("updates last_seen_at when a valid token is used", async () => {
    app = buildApp({ db });
    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });
    const { userId, token } = auth.json();

    await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      headers: { Authorization: `Bearer ${token}` },
      payload: { tool: "tro_alert", input: "nike" },
    });

    const row = db
      .prepare(
        "SELECT created_at AS createdAt, last_seen_at AS lastSeenAt FROM users WHERE id = ?",
      )
      .get(userId) as { createdAt: string; lastSeenAt: string };
    expect(row.lastSeenAt).toBeTruthy();
  });
});
