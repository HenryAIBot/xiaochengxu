import { describe, expect, it, vi } from "vitest";
import { PollTimeoutError, pollUntil } from "./polling";

describe("pollUntil", () => {
  it("returns immediately when predicate passes on first call", async () => {
    const fetcher = vi.fn(async () => ({ status: "completed" }));
    const sleep = vi.fn(async () => {});

    const result = await pollUntil(fetcher, (v) => v.status === "completed", {
      intervalMs: 1,
      timeoutMs: 1000,
      sleep,
    });

    expect(result).toEqual({ status: "completed" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("keeps polling until predicate passes", async () => {
    const values = ["queued", "queued", "completed"];
    let i = 0;
    const fetcher = vi.fn(async () => ({ status: values[i++] }));
    const sleep = vi.fn(async () => {});

    const result = await pollUntil(fetcher, (v) => v.status === "completed", {
      intervalMs: 1,
      timeoutMs: 1000,
      sleep,
    });

    expect(result.status).toBe("completed");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("throws PollTimeoutError when exceeded", async () => {
    const fetcher = vi.fn(async () => ({ status: "queued" }));
    const sleep = vi.fn(async () => {});

    await expect(
      pollUntil(fetcher, (v) => v.status === "completed", {
        intervalMs: 10,
        timeoutMs: 15,
        sleep,
      }),
    ).rejects.toBeInstanceOf(PollTimeoutError);
  });
});
