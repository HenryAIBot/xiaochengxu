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
