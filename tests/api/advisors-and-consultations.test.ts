import type { QueueClient } from "@xiaochengxu/queue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

function makeSpyQueue(): { queue: QueueClient; calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    queue: {
      async enqueueQuery() {},
      async enqueueNotification() {},
      async enqueueAdvisorNotification(payload) {
        calls.push(payload);
      },
      async listFailedNotifications() {
        return [];
      },
      async retryFailedNotification() {
        return { retried: false };
      },
      async close() {},
    },
  };
}

describe("advisors + consultation routing", () => {
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

  it("seeds at least one advisor on boot and exposes them via GET /api/advisors", async () => {
    app = buildApp({ db });
    const res = await app.inject({ method: "GET", url: "/api/advisors" });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ name: string }>;
    expect(items.length).toBeGreaterThan(0);
    // Sensitive fields (phone/email) not exposed
    expect(res.json().items[0]).not.toHaveProperty("phone");
    expect(res.json().items[0]).not.toHaveProperty("email");
  });

  it("auto-assigns consultations round-robin to least-recently-used advisor", async () => {
    app = buildApp({ db });

    const first = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: { name: "Client A", phone: "+15550000001" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: { name: "Client B", phone: "+15550000002" },
    });
    const third = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: { name: "Client C", phone: "+15550000003" },
    });

    const a = first.json().advisorId;
    const b = second.json().advisorId;
    const c = third.json().advisorId;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b); // different advisors between the first two
    expect(c).toBe(a); // third wraps back to the first (LRU)
  });

  it("accepts targetRef and source IDs and round-trips them via GET", async () => {
    app = buildApp({ db });
    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });
    const { token } = auth.json();

    const created = await app.inject({
      method: "POST",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "Seller Zhang",
        phone: "+8615279825102",
        targetRef: { kind: "brand", value: "nike" },
        sourceReportId: "report-abc",
        sourceQueryTaskId: "task-xyz",
        note: "侵权体检命中高风险",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().targetRef).toEqual({ kind: "brand", value: "nike" });
    expect(created.json().sourceReportId).toBe("report-abc");
    expect(created.json().sourceQueryTaskId).toBe("task-xyz");
    expect(created.json().advisor).toEqual(expect.any(String));

    const list = await app.inject({
      method: "GET",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = list.json().items as Array<{
      targetRef: { kind: string; value: string } | null;
      sourceReportId: string | null;
      advisorSpecialty: string | null;
    }>;
    expect(items[0].targetRef).toEqual({ kind: "brand", value: "nike" });
    expect(items[0].sourceReportId).toBe("report-abc");
    expect(items[0].advisorSpecialty).toEqual(expect.any(String));
  });

  it("rejects invalid targetRef.kind with 400", async () => {
    app = buildApp({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: {
        name: "X",
        phone: "+15550000999",
        targetRef: { kind: "not_a_kind", value: "foo" },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH /api/consultations/:id updates status + note and scopes by user", async () => {
    app = buildApp({ db });
    const alice = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });
    const bob = await app.inject({
      method: "POST",
      url: "/api/auth/anonymous",
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${alice.json().token}` },
      payload: { name: "Alice", phone: "+15551111111" },
    });
    const id = created.json().id;

    const byBob = await app.inject({
      method: "PATCH",
      url: `/api/consultations/${id}`,
      headers: { Authorization: `Bearer ${bob.json().token}` },
      payload: { status: "closed" },
    });
    expect(byBob.statusCode).toBe(404);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/consultations/${id}`,
      headers: { Authorization: `Bearer ${alice.json().token}` },
      payload: { status: "closed", note: "already handled" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().status).toBe("closed");
    expect(patched.json().note).toBe("already handled");
  });

  it("enqueues an advisor notification when a consultation auto-assigns", async () => {
    const spy = makeSpyQueue();
    app = buildApp({ db, queue: spy.queue });
    const res = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: {
        name: "Zhang",
        phone: "+8615279825102",
        targetRef: { kind: "brand", value: "nike" },
        sourceReportId: "report-xyz",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    // Give the fire-and-forget `void` call a tick to run.
    await new Promise((resolve) => setImmediate(resolve));
    expect(spy.calls.length).toBe(1);
    const payload = spy.calls[0] as Record<string, unknown>;
    expect(payload.advisorId).toBe(body.advisorId);
    expect(payload.consultationId).toBe(body.id);
    expect(payload.clientName).toBe("Zhang");
    expect(payload.targetRef).toEqual({ kind: "brand", value: "nike" });
    expect(payload.sourceReportId).toBe("report-xyz");
  });

  it("POST /api/internal/advisors requires the shared secret when configured", async () => {
    app = buildApp({ db, internalToken: "shhh" });

    const noAuth = await app.inject({
      method: "POST",
      url: "/api/internal/advisors",
      payload: { name: "王顾问" },
    });
    expect(noAuth.statusCode).toBe(401);

    const withAuth = await app.inject({
      method: "POST",
      url: "/api/internal/advisors",
      headers: { "x-internal-token": "shhh" },
      payload: { name: "王顾问", specialty: "海关查扣" },
    });
    expect(withAuth.statusCode).toBe(201);
    expect(withAuth.json().name).toBe("王顾问");
  });
});
