import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

const ORIGINAL_ENV = {
  AMAZON_LISTING_URL_TEMPLATE: process.env.AMAZON_LISTING_URL_TEMPLATE,
  AMAZON_STORE_URL_TEMPLATE: process.env.AMAZON_STORE_URL_TEMPLATE,
  AMAZON_AUTH_HEADER: process.env.AMAZON_AUTH_HEADER,
};

function restoreAmazonEnv() {
  process.env.AMAZON_LISTING_URL_TEMPLATE =
    ORIGINAL_ENV.AMAZON_LISTING_URL_TEMPLATE;
  process.env.AMAZON_STORE_URL_TEMPLATE =
    ORIGINAL_ENV.AMAZON_STORE_URL_TEMPLATE;
  process.env.AMAZON_AUTH_HEADER = ORIGINAL_ENV.AMAZON_AUTH_HEADER;
}

describe("GET /api/storefronts/:storeName/products live source", () => {
  let db = createInMemoryDb();
  let app: ReturnType<typeof buildApp> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    db.close();
    db = createInMemoryDb();
    restoreAmazonEnv();
    vi.unstubAllGlobals();
  });

  it("uses the configured Amazon store proxy and returns live source metadata", async () => {
    process.env.AMAZON_LISTING_URL_TEMPLATE =
      "https://amazon-proxy.example/listing?asin={asinEncoded}";
    process.env.AMAZON_STORE_URL_TEMPLATE =
      "https://amazon-proxy.example/store?name={storeEncoded}";
    process.env.AMAZON_AUTH_HEADER = "Bearer amazon-token";

    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          items: [
            { asin: "B0LIVE0001", title: "Live product one" },
            { asin: "B0LIVE0002", title: "Live product two" },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchImpl);

    app = buildApp({ db });
    const res = await app.inject({
      method: "GET",
      url: "/api/storefronts/acme%20store/products",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      storeName: "acme store",
      dataSource: "live",
      items: [{ asin: "B0LIVE0001" }, { asin: "B0LIVE0002" }],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://amazon-proxy.example/store?name=acme%20store",
      expect.objectContaining({
        headers: { Authorization: "Bearer amazon-token" },
      }),
    );
  });

  it("returns a visible failure when listing is live but store proxy is missing", async () => {
    process.env.AMAZON_LISTING_URL_TEMPLATE =
      "https://amazon-proxy.example/listing?asin={asinEncoded}";
    process.env.AMAZON_STORE_URL_TEMPLATE = "";

    app = buildApp({ db });
    const res = await app.inject({
      method: "GET",
      url: "/api/storefronts/acme/products",
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      code: "AMAZON_STOREFRONT_SOURCE_UNAVAILABLE",
      dataSource: "live",
    });
  });
});
