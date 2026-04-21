import { describe, expect, it, vi } from "vitest";
import { runMonitorTickProcessor } from "../../services/jobs/src/processors/monitor-tick-processor.js";

describe("runMonitorTickProcessor", () => {
  it("checks each active monitor and counts triggers", async () => {
    const ports = {
      listMonitors: vi.fn(async () => ({
        items: [
          { id: "m1", status: "active" },
          { id: "m2", status: "active" },
          { id: "m3", status: "paused" },
        ],
      })),
      checkMonitor: vi.fn(async (id: string) => ({
        triggered: id === "m1",
      })),
    };

    const result = await runMonitorTickProcessor(ports);

    expect(result).toMatchObject({
      checked: 2,
      triggered: 1,
      skipped: 1,
    });
    expect(ports.checkMonitor).toHaveBeenCalledWith("m1");
    expect(ports.checkMonitor).toHaveBeenCalledWith("m2");
    expect(ports.checkMonitor).not.toHaveBeenCalledWith("m3");
    expect(result.outcomes).toEqual([
      { monitorId: "m1", triggered: true },
      { monitorId: "m2", triggered: false },
    ]);
  });

  it("records per-monitor errors without aborting the tick", async () => {
    const ports = {
      listMonitors: vi.fn(async () => ({
        items: [
          { id: "m1", status: "active" },
          { id: "m2", status: "active" },
        ],
      })),
      checkMonitor: vi
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error("timeout");
        })
        .mockImplementationOnce(async () => ({ triggered: true })),
    };

    const result = await runMonitorTickProcessor(ports);

    expect(result.checked).toBe(2);
    expect(result.triggered).toBe(1);
    expect(result.outcomes).toEqual([
      { monitorId: "m1", triggered: false, error: "timeout" },
      { monitorId: "m2", triggered: true },
    ]);
  });

  it("returns zero counts when no monitors exist", async () => {
    const ports = {
      listMonitors: vi.fn(async () => ({ items: [] })),
      checkMonitor: vi.fn(),
    };

    const result = await runMonitorTickProcessor(ports);
    expect(result).toMatchObject({
      checked: 0,
      triggered: 0,
      skipped: 0,
    });
    expect(ports.checkMonitor).not.toHaveBeenCalled();
  });
});
