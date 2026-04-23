import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

async function registerUser(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/anonymous",
  });
  return res.json() as { userId: string; token: string };
}

async function createMonitor(
  app: ReturnType<typeof buildApp>,
  token: string,
  targetValue = "nike",
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/monitors",
    headers: { Authorization: `Bearer ${token}` },
    payload: { targetKind: "brand", targetValue },
  });
  return res.json().id as string;
}

describe("monitor lifecycle (pause / resume / delete)", () => {
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

  it("PATCH toggles status between active and paused", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const id = await createMonitor(app, alice.token);

    const paused = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { status: "paused" },
    });
    expect(paused.statusCode).toBe(200);
    expect(
      (
        db.prepare("SELECT status FROM monitors WHERE id = ?").get(id) as {
          status: string;
        }
      ).status,
    ).toBe("paused");

    const resumed = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { status: "active" },
    });
    expect(resumed.statusCode).toBe(200);
    expect(
      (
        db.prepare("SELECT status FROM monitors WHERE id = ?").get(id) as {
          status: string;
        }
      ).status,
    ).toBe("active");
  });

  it("PATCH rejects invalid status via schema", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const id = await createMonitor(app, alice.token);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { status: "archived" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE removes the monitor and returns 204", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const id = await createMonitor(app, alice.token);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(204);
    const row = db.prepare("SELECT id FROM monitors WHERE id = ?").get(id) as
      | { id: string }
      | undefined;
    expect(row).toBeUndefined();
  });

  it("PATCH updates tickIntervalSeconds and persists on the row", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const id = await createMonitor(app, alice.token);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { tickIntervalSeconds: 900 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tickIntervalSeconds).toBe(900);

    const row = db
      .prepare(
        "SELECT tick_interval_seconds AS interval FROM monitors WHERE id = ?",
      )
      .get(id) as { interval: number };
    expect(row.interval).toBe(900);
  });

  it("PATCH rejects tickIntervalSeconds outside [60, 86400]", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const id = await createMonitor(app, alice.token);

    const tooShort = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { tickIntervalSeconds: 10 },
    });
    expect(tooShort.statusCode).toBe(400);

    const tooLong = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { tickIntervalSeconds: 100_000 },
    });
    expect(tooLong.statusCode).toBe(400);
  });

  it("GET returns tickIntervalSeconds when set", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: {
        targetKind: "brand",
        targetValue: "apple",
        tickIntervalSeconds: 1800,
      },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/monitors",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    const items = list.json().items as Array<{
      tickIntervalSeconds: number | null;
    }>;
    expect(items[0]?.tickIntervalSeconds).toBe(1800);
  });

  it("PATCH and DELETE 404 across users", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const id = await createMonitor(app, alice.token);

    const bobPatch = await app.inject({
      method: "PATCH",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${bob.token}` },
      payload: { status: "paused" },
    });
    expect(bobPatch.statusCode).toBe(404);

    const bobDelete = await app.inject({
      method: "DELETE",
      url: `/api/monitors/${id}`,
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(bobDelete.statusCode).toBe(404);

    expect(
      db.prepare("SELECT id FROM monitors WHERE id = ?").get(id),
    ).toBeTruthy();
  });
});
