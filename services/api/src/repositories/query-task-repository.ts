import { randomUUID } from "node:crypto";
import type { NormalizedInput, ToolName } from "@xiaochengxu/core";
import type { QueryTaskDatabase } from "../lib/db.js";

export interface QueryTaskRecord {
  id: string;
  tool: ToolName;
  inputKind: NormalizedInput["kind"];
  rawInput: string;
  normalizedInput: string;
  status: "queued";
  createdAt: string;
}

export class QueryTaskRepository {
  constructor(private readonly db: QueryTaskDatabase) {}

  create(input: {
    tool: ToolName;
    rawInput: string;
    normalizedInput: NormalizedInput;
  }): QueryTaskRecord {
    const record: QueryTaskRecord = {
      id: randomUUID(),
      tool: input.tool,
      inputKind: input.normalizedInput.kind,
      rawInput: input.rawInput,
      normalizedInput: input.normalizedInput.normalizedValue,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO query_tasks (id, tool, input_kind, raw_input, normalized_input, status, created_at)
         VALUES (@id, @tool, @inputKind, @rawInput, @normalizedInput, @status, @createdAt)`,
      )
      .run(record);

    return record;
  }
}
