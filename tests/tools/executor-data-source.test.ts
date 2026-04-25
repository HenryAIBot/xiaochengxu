import {
  createDefaultToolExecutor,
  mergeDataSources,
  resolveAmazonConnector,
  resolveCourtListenerConnector,
  resolveUsptoConnector,
} from "@xiaochengxu/tools";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("mergeDataSources", () => {
  it("returns the single source when all are identical", () => {
    expect(mergeDataSources("fixture", "fixture")).toBe("fixture");
    expect(mergeDataSources("live", "live")).toBe("live");
  });

  it('returns "mixed" when sources differ', () => {
    expect(mergeDataSources("fixture", "live")).toBe("mixed");
  });
});

describe("resolveCourtListenerConnector", () => {
  const originalToken = process.env.COURTLISTENER_API_TOKEN;

  beforeEach(() => {
    process.env.COURTLISTENER_API_TOKEN = "";
  });

  afterEach(() => {
    process.env.COURTLISTENER_API_TOKEN = originalToken ?? "";
  });

  it("returns fixture connector when no token is set", () => {
    process.env.COURTLISTENER_API_TOKEN = "";
    const resolved = resolveCourtListenerConnector();
    expect(resolved.source).toBe("fixture");
  });

  it("returns live connector when token is set", () => {
    process.env.COURTLISTENER_API_TOKEN = "fake-token";
    const resolved = resolveCourtListenerConnector();
    expect(resolved.source).toBe("live");
  });

  it("respects explicit override regardless of env", () => {
    process.env.COURTLISTENER_API_TOKEN = "fake-token";
    const stub = {
      search: async () => ({ results: [] }),
      getDocket: async () => ({ entries: [] }),
    };
    const resolved = resolveCourtListenerConnector({
      connector: stub,
      source: "fixture",
    });
    expect(resolved.source).toBe("fixture");
    expect(resolved.connector).toBe(stub);
  });
});

describe("resolveAmazonConnector", () => {
  const originalRainforestKey = process.env.RAINFOREST_API_KEY;
  const originalListingTemplate = process.env.AMAZON_LISTING_URL_TEMPLATE;
  const originalStoreTemplate = process.env.AMAZON_STORE_URL_TEMPLATE;

  afterEach(() => {
    process.env.RAINFOREST_API_KEY = originalRainforestKey ?? "";
    process.env.AMAZON_LISTING_URL_TEMPLATE = originalListingTemplate ?? "";
    process.env.AMAZON_STORE_URL_TEMPLATE = originalStoreTemplate ?? "";
  });

  it("uses Rainforest as a live Amazon source when configured", () => {
    process.env.RAINFOREST_API_KEY = "rainforest-key";
    process.env.AMAZON_LISTING_URL_TEMPLATE = "";
    process.env.AMAZON_STORE_URL_TEMPLATE = "";

    const resolved = resolveAmazonConnector();

    expect(resolved.source).toBe("live");
    expect(resolved.connector.getListingHtml).toEqual(expect.any(Function));
    expect(resolved.connector.listStoreProducts).toEqual(expect.any(Function));
  });
});

describe("resolveUsptoConnector", () => {
  const originalProvider = process.env.USPTO_SEARCH_PROVIDER;
  const originalTemplate = process.env.USPTO_SEARCH_URL_TEMPLATE;

  afterEach(() => {
    process.env.USPTO_SEARCH_PROVIDER = originalProvider ?? "";
    process.env.USPTO_SEARCH_URL_TEMPLATE = originalTemplate ?? "";
  });

  it("uses Markbase as a live trademark source when selected", () => {
    process.env.USPTO_SEARCH_PROVIDER = "markbase";
    process.env.USPTO_SEARCH_URL_TEMPLATE = "";

    const resolved = resolveUsptoConnector();

    expect(resolved.source).toBe("live");
    expect(resolved.connector.searchMarks).toEqual(expect.any(Function));
  });
});

describe("createDefaultToolExecutor dataSource", () => {
  it("returns fixture for fixture CourtListener", async () => {
    const runTool = createDefaultToolExecutor({
      courtListener: {
        connector: {
          search: async () => ({ results: [] }),
          getDocket: async () => ({ entries: [] }),
        },
        source: "fixture",
      },
    });
    const result = await runTool({
      tool: "tro_alert",
      normalizedInput: { kind: "brand", rawValue: "x", normalizedValue: "x" },
    });
    expect(result.dataSource).toBe("fixture");
  });

  it("returns live for live CourtListener on tro_alert", async () => {
    const runTool = createDefaultToolExecutor({
      courtListener: {
        connector: {
          search: async () => ({
            results: [
              {
                caseName: "X v. Y",
                snippet: "Temporary restraining order granted.",
              },
            ],
          }),
          getDocket: async () => ({ entries: [] }),
        },
        source: "live",
      },
    });
    const result = await runTool({
      tool: "tro_alert",
      normalizedInput: { kind: "brand", rawValue: "x", normalizedValue: "x" },
    });
    expect(result.dataSource).toBe("live");
    expect(result.level).toBe("suspected_high");
  });

  it("infringement_check stays fixture (Amazon + USPTO still fixture)", async () => {
    const runTool = createDefaultToolExecutor({
      courtListener: {
        connector: {
          search: async () => ({ results: [] }),
          getDocket: async () => ({ entries: [] }),
        },
        source: "live",
      },
    });
    const result = await runTool({
      tool: "infringement_check",
      normalizedInput: {
        kind: "brand",
        rawValue: "apple",
        normalizedValue: "apple",
      },
    });
    expect(result.dataSource).toBe("fixture");
  });
});
