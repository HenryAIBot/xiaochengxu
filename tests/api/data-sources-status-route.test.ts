import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("GET /api/internal/data-sources/status", () => {
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

  it("reports configured source state without exposing secret values", async () => {
    app = buildApp({ db, internalToken: "secret" });

    const blocked = await app.inject({
      method: "GET",
      url: "/api/internal/data-sources/status",
    });
    expect(blocked.statusCode).toBe(401);

    const allowed = await app.inject({
      method: "GET",
      url: "/api/internal/data-sources/status",
      headers: { "x-internal-token": "secret" },
    });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          provider: "courtlistener",
          capability: "court_search",
          requiredEnv: ["COURTLISTENER_API_TOKEN"],
        }),
        expect.objectContaining({
          provider: "amazon",
          capability: "storefront_lookup",
        }),
      ]),
    });
    expect(JSON.stringify(allowed.json())).not.toContain("secret");
  });
});
