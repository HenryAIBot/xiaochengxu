import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuditLogEntry,
  buildApp,
  createInMemoryDb,
} from "../../services/api/src/app.js";

describe("rate limit", () => {
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

  it("returns 429 once the request quota is exceeded", async () => {
    app = buildApp({
      db,
      rateLimit: { max: 3, timeWindow: "1 minute" },
      auditLog: null,
    });
    await app.ready();

    for (let i = 0; i < 3; i++) {
      const ok = await app.inject({ method: "GET", url: "/api/monitors" });
      expect(ok.statusCode).toBe(200);
    }

    const blocked = await app.inject({ method: "GET", url: "/api/monitors" });
    expect(blocked.statusCode).toBe(429);
  });
});

describe("audit log", () => {
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

  it("invokes the audit hook with structured fields per request", async () => {
    const entries: AuditLogEntry[] = [];
    app = buildApp({
      db,
      auditLog: (entry) => {
        entries.push(entry);
      },
    });

    await app.inject({ method: "GET", url: "/health" });
    await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      method: "GET",
      url: "/health",
      statusCode: 200,
      userId: null,
    });
    expect(entries[1]).toMatchObject({
      method: "POST",
      url: "/api/query-tasks",
      statusCode: 202,
    });
    for (const e of entries) {
      expect(e.durationMs).toBeTypeOf("number");
      expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("records user_id when the caller is authenticated", async () => {
    const entries: AuditLogEntry[] = [];
    app = buildApp({ db, auditLog: (e) => entries.push(e) });
    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });
    const { userId, token } = auth.json();

    await app.inject({
      method: "GET",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${token}` },
    });

    const monitorCall = entries.find((e) => e.url === "/api/monitors");
    expect(monitorCall?.userId).toBe(userId);
  });

  it("can be disabled by passing null", async () => {
    const spy = vi.fn();
    app = buildApp({ db, auditLog: null });
    await app.inject({ method: "GET", url: "/health" });
    expect(spy).not.toHaveBeenCalled();
  });
});
