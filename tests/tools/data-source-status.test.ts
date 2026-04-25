import {
  FixtureAmazonListingConnector,
  describeDefaultDataSources,
} from "@xiaochengxu/tools";
import { describe, expect, it } from "vitest";

describe("describeDefaultDataSources", () => {
  it("marks capabilities as fixture until their required env is present", () => {
    const result = describeDefaultDataSources({});

    expect(result.items).toContainEqual(
      expect.objectContaining({
        provider: "courtlistener",
        capability: "court_search",
        dataSource: "fixture",
        missingEnv: ["COURTLISTENER_API_TOKEN"],
      }),
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({
        provider: "uspto",
        capability: "trademark_search",
        dataSource: "fixture",
        missingEnv: [
          "USPTO_SEARCH_URL_TEMPLATE or USPTO_SEARCH_PROVIDER=markbase",
        ],
      }),
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({
        provider: "amazon",
        capability: "storefront_lookup",
        dataSource: "fixture",
        missingEnv: [
          "AMAZON_LISTING_URL_TEMPLATE",
          "AMAZON_STORE_URL_TEMPLATE",
        ],
      }),
    );
  });

  it("marks each capability as live when required env is configured", () => {
    const result = describeDefaultDataSources({
      COURTLISTENER_API_TOKEN: "token",
      USPTO_SEARCH_URL_TEMPLATE: "https://uspto.example?q={termEncoded}",
      AMAZON_LISTING_URL_TEMPLATE:
        "https://amazon.example/listing?asin={asinEncoded}",
      AMAZON_STORE_URL_TEMPLATE: "https://amazon.example/store?name={store}",
    });

    expect(result.items.every((item) => item.dataSource === "live")).toBe(true);
  });

  it("marks USPTO trademark search as live when Markbase is selected", () => {
    const result = describeDefaultDataSources({
      USPTO_SEARCH_PROVIDER: "markbase",
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({
        provider: "uspto",
        capability: "trademark_search",
        dataSource: "live",
        requiredEnv: ["USPTO_SEARCH_PROVIDER"],
        missingEnv: [],
      }),
    );
  });

  it("marks Amazon capabilities as live when Rainforest is configured directly", () => {
    const result = describeDefaultDataSources({
      RAINFOREST_API_KEY: "rainforest-key",
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({
        provider: "amazon",
        capability: "listing_lookup",
        dataSource: "live",
        requiredEnv: ["RAINFOREST_API_KEY"],
      }),
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({
        provider: "amazon",
        capability: "storefront_lookup",
        dataSource: "live",
        requiredEnv: ["RAINFOREST_API_KEY"],
      }),
    );
  });
});

describe("FixtureAmazonListingConnector storefront lookup", () => {
  it("returns representative products without hitting external sources", async () => {
    const connector = new FixtureAmazonListingConnector();
    const result = await connector.listStoreProducts("nike store");

    expect(result.items[0]).toMatchObject({
      asin: "B0C1234567",
      title: expect.stringContaining("Nike"),
    });
    expect(result.items.length).toBeGreaterThan(0);
  });
});
