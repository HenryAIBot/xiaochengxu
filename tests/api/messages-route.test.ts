import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("messages route", () => {
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

  it("persists a posted message and returns it in the list", async () => {
    app = buildApp({ db });

    const created = await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: {
        channel: "email",
        body: "监控品牌命中新的投诉。",
        monitorId: "monitor-1",
        level: "suspected_high",
        to: "seller@example.com",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      channel: "email",
      monitorId: "monitor-1",
      level: "suspected_high",
      toAddress: "seller@example.com",
    });

    const list = await app.inject({ method: "GET", url: "/api/messages" });
    expect(list.statusCode).toBe(200);
    const items = list.json() as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      channel: "email",
      monitorId: "monitor-1",
      level: "suspected_high",
      toAddress: "seller@example.com",
    });
  });

  it("rejects invalid payloads", async () => {
    app = buildApp({ db });

    const missing = await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: { channel: "email" },
    });
    expect(missing.statusCode).toBe(400);

    const badChannel = await app.inject({
      method: "POST",
      url: "/api/messages",
      payload: { channel: "fax", body: "hi" },
    });
    expect(badChannel.statusCode).toBe(400);
  });
});
