import { describe, expect, it } from "vitest";
import { redisConnectionOptions } from "../../services/jobs/src/redis-options.js";

describe("redis connection options", () => {
  it("disables per-request retries for BullMQ workers", () => {
    expect(redisConnectionOptions.maxRetriesPerRequest).toBeNull();
  });
});
