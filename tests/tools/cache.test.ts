import { TtlCache, createDefaultToolExecutor } from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

describe("TtlCache", () => {
  it("returns cached value within ttl and expires after", () => {
    let now = 1_000_000;
    const cache = new TtlCache<number>({ ttlMs: 100, now: () => now });
    cache.set("k", 42);
    expect(cache.get("k")?.value).toBe(42);
    now += 50;
    expect(cache.get("k")?.value).toBe(42);
    now += 100;
    expect(cache.get("k")).toBeNull();
  });

  it("fetchOrLoad only invokes loader on cache miss", async () => {
    const cache = new TtlCache<number>({ ttlMs: 1000 });
    const loader = vi.fn(async () => 7);
    const first = await cache.fetchOrLoad("x", loader);
    const second = await cache.fetchOrLoad("x", loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(first.value).toBe(7);
    expect(second.value).toBe(7);
  });
});

describe("createDefaultToolExecutor cache behavior", () => {
  it("caches tool results by (tool, input) key and reuses sourceFetchedAt", async () => {
    const searchSpy = vi.fn(async () => ({
      results: [
        {
          caseName: "X v. Y",
          snippet: "Temporary restraining order granted.",
        },
      ],
    }));
    const runTool = createDefaultToolExecutor({
      courtListener: {
        connector: {
          search: searchSpy,
          getDocket: async () => ({ entries: [] }),
        },
        source: "live",
      },
      cacheTtlMs: 60_000,
    });

    const first = await runTool({
      tool: "tro_alert",
      normalizedInput: {
        kind: "brand",
        rawValue: "nike",
        normalizedValue: "nike",
      },
    });
    const second = await runTool({
      tool: "tro_alert",
      normalizedInput: {
        kind: "brand",
        rawValue: "nike",
        normalizedValue: "nike",
      },
    });

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(first.sourceFetchedAt).toBeTruthy();
    expect(second.sourceFetchedAt).toBe(first.sourceFetchedAt);
  });

  it("does not share cache across different normalized inputs", async () => {
    const searchSpy = vi.fn(async () => ({
      results: [{ caseName: "X", snippet: "y" }],
    }));
    const runTool = createDefaultToolExecutor({
      courtListener: {
        connector: {
          search: searchSpy,
          getDocket: async () => ({ entries: [] }),
        },
        source: "live",
      },
    });

    await runTool({
      tool: "tro_alert",
      normalizedInput: {
        kind: "brand",
        rawValue: "nike",
        normalizedValue: "nike",
      },
    });
    await runTool({
      tool: "tro_alert",
      normalizedInput: {
        kind: "brand",
        rawValue: "adidas",
        normalizedValue: "adidas",
      },
    });
    expect(searchSpy).toHaveBeenCalledTimes(2);
  });
});
