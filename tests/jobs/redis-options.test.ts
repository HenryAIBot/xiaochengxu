import { redisConnectionOptions } from "@xiaochengxu/queue";
import { describe, expect, it } from "vitest";

describe("redis connection options", () => {
  it("disables per-request retries for BullMQ workers", () => {
    expect(redisConnectionOptions.maxRetriesPerRequest).toBeNull();
  });
});
