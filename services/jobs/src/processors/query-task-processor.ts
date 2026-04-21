import type { ToolName } from "@xiaochengxu/core";
import type { ToolResult } from "@xiaochengxu/tools";

export interface QueryTaskJob {
  taskId: string;
}

export interface QueryTaskRawRecord {
  taskId: string;
  tool: ToolName;
  normalizedInput: {
    kind: "asin" | "brand" | "store_name" | "case_number";
    rawValue: string;
    normalizedValue: string;
  };
  status: string;
}

export interface QueryTaskProcessorPorts {
  loadTask: (taskId: string) => Promise<QueryTaskRawRecord>;
  runTool: (task: QueryTaskRawRecord) => Promise<ToolResult>;
  postResult: (taskId: string, result: ToolResult) => Promise<void>;
  postFailure: (taskId: string, error: string) => Promise<void>;
}

export async function runQueryTaskProcessor(
  job: QueryTaskJob,
  ports: QueryTaskProcessorPorts,
) {
  let task: QueryTaskRawRecord;
  try {
    task = await ports.loadTask(job.taskId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ports.postFailure(job.taskId, `loadTask failed: ${message}`);
    return { status: "failed" as const, reason: message };
  }

  try {
    const result = await ports.runTool(task);
    await ports.postResult(job.taskId, result);
    return { status: "completed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ports.postFailure(job.taskId, message);
    return { status: "failed" as const, reason: message };
  }
}
