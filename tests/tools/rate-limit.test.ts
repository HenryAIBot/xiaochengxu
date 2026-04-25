import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTokenBucketLimiter,
  readLimiterConfig,
  wrapConnectorWithLimiter,
} from "../../packages/tools/src/rate-limit.js";

describe("createTokenBucketLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("grants N immediate tokens then blocks until refill", async () => {
    const limiter = createTokenBucketLimiter({
      capacity: 2,
      refillIntervalMs: 1000,
    });

    await limiter.acquire();
    await limiter.acquire();

    let resolved = false;
    void limiter.acquire().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it("does not exceed capacity when idle", async () => {
    const limiter = createTokenBucketLimiter({
      capacity: 3,
      refillIntervalMs: 100,
    });

    vi.advanceTimersByTime(10_000);

    // Burst of 3 fires immediately, 4th blocks.
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    let resolved = false;
    void limiter.acquire().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
  });
});

describe("wrapConnectorWithLimiter", () => {
  it("delays method calls past the bucket", async () => {
    const inner = { fetchOne: vi.fn(async (x: number) => x * 2) };
    const limiter = createTokenBucketLimiter({
      capacity: 1,
      refillIntervalMs: 5000,
    });
    const wrapped = wrapConnectorWithLimiter(
      inner as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >,
      limiter,
    );

    const first = await wrapped.fetchOne(1);
    expect(first).toBe(2);
    expect(inner.fetchOne).toHaveBeenCalledTimes(1);
  });
});

describe("readLimiterConfig", () => {
  it("reads env overrides per provider", () => {
    process.env.PROVIDER_RATE_LIMIT_USPTO_CAPACITY = "42";
    process.env.PROVIDER_RATE_LIMIT_USPTO_REFILL_MS = "3000";
    try {
      const cfg = readLimiterConfig("uspto", {
        capacity: 10,
        refillIntervalMs: 1000,
      });
      expect(cfg).toEqual({ capacity: 42, refillIntervalMs: 3000 });
    } finally {
      process.env.PROVIDER_RATE_LIMIT_USPTO_CAPACITY = undefined;
      process.env.PROVIDER_RATE_LIMIT_USPTO_REFILL_MS = undefined;
    }
  });

  it("falls back to defaults when env unset", () => {
    process.env.PROVIDER_RATE_LIMIT_COURTLISTENER_CAPACITY = undefined;
    process.env.PROVIDER_RATE_LIMIT_COURTLISTENER_REFILL_MS = undefined;
    const cfg = readLimiterConfig("courtlistener", {
      capacity: 7,
      refillIntervalMs: 500,
    });
    expect(cfg).toEqual({ capacity: 7, refillIntervalMs: 500 });
  });
});
