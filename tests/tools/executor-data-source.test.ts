import {
  createDefaultToolExecutor,
  mergeDataSources,
  resolveCourtListenerConnector,
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
