import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("request validation", () => {
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

  describe("POST /api/monitors", () => {
    it("rejects missing targetValue", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/monitors",
        payload: { targetKind: "brand" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid targetKind", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/monitors",
        payload: { targetKind: "seller_id", targetValue: "nike" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects malformed email", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/monitors",
        payload: {
          targetKind: "brand",
          targetValue: "nike",
          notifyEmail: "not-an-email",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects malformed phone", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/monitors",
        payload: {
          targetKind: "brand",
          targetValue: "nike",
          notifyPhone: "abc",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts case_number target kind", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/monitors",
        payload: {
          targetKind: "case_number",
          targetValue: "1:25-cv-01234",
        },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("POST /api/leads", () => {
    it("rejects an empty body (at least one contact required)", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/leads",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects a malformed email", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/leads",
        payload: { email: "nope" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts phone only", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/leads",
        payload: { phone: "+8613800138000" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        phone: "+8613800138000",
        email: null,
      });
    });
  });

  describe("POST /api/messages", () => {
    it("rejects unknown channel", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: { channel: "fax", body: "hi" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects empty body string", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: { channel: "email", body: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("silently drops unknown fields (Fastify ajv default)", async () => {
      app = buildApp({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          channel: "email",
          body: "x",
          foo: "bar",
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).not.toHaveProperty("foo");
    });
  });
});
