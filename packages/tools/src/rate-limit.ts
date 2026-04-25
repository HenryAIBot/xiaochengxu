/**
 * Token-bucket rate limiter for outbound provider calls.
 *
 * We cap calls to each external provider (USPTO proxy, CourtListener,
 * Amazon fetcher) so a burst of user queries can't get our IP / API key
 * throttled or banned.
 *
 * Config is per-provider + read from env:
 *   PROVIDER_RATE_LIMIT_<NAME>_CAPACITY   (max concurrent burst, default 10)
 *   PROVIDER_RATE_LIMIT_<NAME>_REFILL_MS  (ms between each token refill,
 *                                          default 1000 ms = 1 req/sec)
 *
 * Where <NAME> ∈ USPTO | COURTLISTENER | AMAZON.
 */

export interface RateLimiterOptions {
  /** How many tokens the bucket holds. Caps burst size. */
  capacity: number;
  /** Refill one token every `refillIntervalMs` milliseconds. */
  refillIntervalMs: number;
}

export interface RateLimiter {
  /** Resolves when a token is available. */
  acquire(): Promise<void>;
}

export function createTokenBucketLimiter(
  opts: RateLimiterOptions,
): RateLimiter {
  let tokens = opts.capacity;
  let lastRefillAt = Date.now();
  const waiters: Array<() => void> = [];

  function refill() {
    const now = Date.now();
    const elapsed = now - lastRefillAt;
    if (elapsed >= opts.refillIntervalMs) {
      const granted = Math.floor(elapsed / opts.refillIntervalMs);
      tokens = Math.min(opts.capacity, tokens + granted);
      lastRefillAt = now;
      while (tokens > 0 && waiters.length > 0) {
        const next = waiters.shift();
        if (next) {
          tokens -= 1;
          next();
        }
      }
    }
  }

  return {
    acquire() {
      refill();
      if (tokens > 0) {
        tokens -= 1;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
        // Self-tick: schedule another refill attempt.
        setTimeout(() => refill(), opts.refillIntervalMs);
      });
    },
  };
}

export function readLimiterConfig(
  name: string,
  defaults: RateLimiterOptions,
): RateLimiterOptions {
  const prefix = `PROVIDER_RATE_LIMIT_${name.toUpperCase()}_`;
  const capacity = Number(
    process.env[`${prefix}CAPACITY`] ?? defaults.capacity,
  );
  const refill = Number(
    process.env[`${prefix}REFILL_MS`] ?? defaults.refillIntervalMs,
  );
  return {
    capacity:
      Number.isFinite(capacity) && capacity > 0 ? capacity : defaults.capacity,
    refillIntervalMs:
      Number.isFinite(refill) && refill > 0
        ? refill
        : defaults.refillIntervalMs,
  };
}

export function wrapConnectorWithLimiter<
  T extends Record<string, (...args: unknown[]) => Promise<unknown>>,
>(connector: T, limiter: RateLimiter): T {
  // Proxy the connector so every async method waits for a token first.
  return new Proxy(connector, {
    get(target, prop: string | symbol) {
      const value = (target as Record<string | symbol, unknown>)[prop];
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await limiter.acquire();
        return (value as (...args: unknown[]) => Promise<unknown>).apply(
          target,
          args,
        );
      };
    },
  }) as T;
}
