import { describe, expect, it, vi } from "vitest";
import {
  type QueryTaskRawRecord,
  runQueryTaskProcessor,
} from "../../services/jobs/src/processors/query-task-processor.js";

const task: QueryTaskRawRecord = {
  taskId: "task-1",
  tool: "tro_alert",
  status: "queued",
  normalizedInput: {
    kind: "brand",
    rawValue: "nike",
    normalizedValue: "nike",
  },
};

describe("runQueryTaskProcessor", () => {
  it("loads task, runs tool, and posts result", async () => {
    const ports = {
      loadTask: vi.fn(async () => task),
      runTool: vi.fn(async () => ({
        level: "suspected_high",
        summary: "hit",
        evidence: [],
        recommendedActions: ["act"],
        dataSource: "fixture" as const,
      })),
      postResult: vi.fn(async () => {}),
      postFailure: vi.fn(async () => {}),
    };

    const result = await runQueryTaskProcessor({ taskId: "task-1" }, ports);

    expect(result).toEqual({ status: "completed" });
    expect(ports.loadTask).toHaveBeenCalledWith("task-1");
    expect(ports.runTool).toHaveBeenCalledWith(task);
    expect(ports.postResult).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ level: "suspected_high" }),
    );
    expect(ports.postFailure).not.toHaveBeenCalled();
  });

  it("reports failure when runTool throws", async () => {
    const ports = {
      loadTask: vi.fn(async () => task),
      runTool: vi.fn(async () => {
        throw new Error("外部服务超时");
      }),
      postResult: vi.fn(async () => {}),
      postFailure: vi.fn(async () => {}),
    };

    const result = await runQueryTaskProcessor({ taskId: "task-1" }, ports);

    expect(result).toEqual({ status: "failed", reason: "外部服务超时" });
    expect(ports.postFailure).toHaveBeenCalledWith("task-1", "外部服务超时");
    expect(ports.postResult).not.toHaveBeenCalled();
  });

  it("reports failure when loadTask throws", async () => {
    const ports = {
      loadTask: vi.fn(async () => {
        throw new Error("not found");
      }),
      runTool: vi.fn(async () => {
        throw new Error("should not run");
      }),
      postResult: vi.fn(async () => {}),
      postFailure: vi.fn(async () => {}),
    };

    const result = await runQueryTaskProcessor({ taskId: "task-x" }, ports);

    expect(result).toMatchObject({ status: "failed" });
    expect(ports.postFailure).toHaveBeenCalledWith(
      "task-x",
      expect.stringContaining("loadTask failed"),
    );
    expect(ports.runTool).not.toHaveBeenCalled();
  });
});
