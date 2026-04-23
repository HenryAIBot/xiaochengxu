import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

async function registerUser(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/anonymous",
  });
  return res.json() as { userId: string; token: string };
}

describe("consultations routes", () => {
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

  it("creates a consultation and returns it in GET /api/consultations", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);

    const created = await app.inject({
      method: "POST",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: {
        name: "张三",
        phone: "+8613800138000",
        note: "亚马逊店铺收到 TRO 起诉",
      },
    });
    expect(created.statusCode).toBe(201);
    // Seeded advisors auto-assign, so status flips to "assigned"
    expect(created.json()).toMatchObject({
      name: "张三",
      phone: "+8613800138000",
      status: "assigned",
    });
    expect(created.json().advisor).toEqual(expect.any(String));
    expect(created.json().advisorId).toEqual(expect.any(String));

    const list = await app.inject({
      method: "GET",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect((list.json().items as unknown[]).length).toBe(1);
  });

  it("rejects invalid phone and missing required fields", async () => {
    app = buildApp({ db });

    const missing = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: { name: "张三" },
    });
    expect(missing.statusCode).toBe(400);

    const badPhone = await app.inject({
      method: "POST",
      url: "/api/consultations",
      payload: { name: "张三", phone: "hello" },
    });
    expect(badPhone.statusCode).toBe(400);
  });

  it("isolates consultations across users", async () => {
    app = buildApp({ db });
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    await app.inject({
      method: "POST",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${alice.token}` },
      payload: { name: "Alice", phone: "+15551111111" },
    });
    await app.inject({
      method: "POST",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${bob.token}` },
      payload: { name: "Bob", phone: "+15552222222" },
    });

    const aliceList = await app.inject({
      method: "GET",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    const bobList = await app.inject({
      method: "GET",
      url: "/api/consultations",
      headers: { Authorization: `Bearer ${bob.token}` },
    });

    const aliceNames = (aliceList.json().items as Array<{ name: string }>).map(
      (c) => c.name,
    );
    const bobNames = (bobList.json().items as Array<{ name: string }>).map(
      (c) => c.name,
    );
    expect(aliceNames).toEqual(["Alice"]);
    expect(bobNames).toEqual(["Bob"]);
  });
});
