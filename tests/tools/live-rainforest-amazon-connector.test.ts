import { LiveRainforestAmazonConnector } from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

function mockFetch(body: unknown, ok = true) {
  return vi.fn(async () => {
    return {
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? "OK" : "Error",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("LiveRainforestAmazonConnector", () => {
  it("fetches product details and converts them to listing HTML", async () => {
    const fetchImpl = mockFetch({
      product: {
        asin: "B000TEST01",
        title: "Nike Test Shoe",
        brand: "Nike",
        feature_bullets: ["Comfort foam", "Rubber outsole"],
        description: "A sample product",
        categories: [{ name: "Shoes" }, { name: "Running" }],
        buybox_winner: { price: { raw: "$99.99" } },
      },
    });
    const connector = new LiveRainforestAmazonConnector({
      apiKey: "test-key",
      baseUrl: "https://rainforest.example/request",
      fetchImpl,
    });

    const html = await connector.getListingHtml("B000TEST01");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://rainforest.example/request?api_key=test-key&amazon_domain=amazon.com&type=product&asin=B000TEST01",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
    expect(html).toContain("Nike Test Shoe");
    expect(html).toContain("Brand: Nike");
    expect(html).toContain("Comfort foam");
  });

  it("searches store names as search terms and maps ASIN candidates", async () => {
    const fetchImpl = mockFetch({
      search_results: [
        { asin: "B000TEST01", title: "Product one" },
        { asin: "", title: "Bad row" },
        { asin: "B000TEST02", title: "Product two" },
      ],
    });
    const connector = new LiveRainforestAmazonConnector({
      apiKey: "test-key",
      baseUrl: "https://rainforest.example/request",
      fetchImpl,
    });

    const result = await connector.listStoreProducts("nike store");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://rainforest.example/request?api_key=test-key&amazon_domain=amazon.com&type=search&search_term=nike+store",
      expect.any(Object),
    );
    expect(result.items).toEqual([
      { asin: "B000TEST01", title: "Product one" },
      { asin: "B000TEST02", title: "Product two" },
    ]);
  });

  it("treats Amazon seller ids as seller_products lookups", async () => {
    const fetchImpl = mockFetch({
      seller_results: [{ asin: "B000SELLER1", title: "Seller product" }],
    });
    const connector = new LiveRainforestAmazonConnector({
      apiKey: "test-key",
      baseUrl: "https://rainforest.example/request",
      fetchImpl,
    });

    const result = await connector.listStoreProducts("A123456789");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://rainforest.example/request?api_key=test-key&amazon_domain=amazon.com&type=seller_products&seller_id=A123456789",
      expect.any(Object),
    );
    expect(result.items).toEqual([
      { asin: "B000SELLER1", title: "Seller product" },
    ]);
  });

  it("throws on non-2xx responses", async () => {
    const connector = new LiveRainforestAmazonConnector({
      apiKey: "test-key",
      fetchImpl: mockFetch({ error: "boom" }, false),
    });

    await expect(connector.getListingHtml("B000TEST01")).rejects.toThrow(
      /Rainforest API product failed: 500/,
    );
  });
});
