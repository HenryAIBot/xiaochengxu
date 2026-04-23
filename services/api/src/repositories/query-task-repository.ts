import { randomUUID } from "node:crypto";
import type { NormalizedInput, ToolName } from "@xiaochengxu/core";
import type { DatabaseAdapter } from "../lib/db-adapter.js";

export interface QueryTaskRecord {
  id: string;
  tool: ToolName;
  inputKind: NormalizedInput["kind"];
  rawInput: string;
  normalizedInput: string;
  status: "queued";
  createdAt: string;
  userId: string | null;
}

export class QueryTaskRepository {
  constructor(private readonly db: DatabaseAdapter) {}

  async create(input: {
    tool: ToolName;
    rawInput: string;
    normalizedInput: NormalizedInput;
    userId?: string | null;
  }): Promise<QueryTaskRecord> {
    const record: QueryTaskRecord = {
      id: randomUUID(),
      tool: input.tool,
      inputKind: input.normalizedInput.kind,
      rawInput: input.rawInput,
      normalizedInput: input.normalizedInput.normalizedValue,
      status: "queued",
      createdAt: new Date().toISOString(),
      userId: input.userId ?? null,
    };

    await this.db
      .prepare(
        `INSERT INTO query_tasks (id, tool, input_kind, raw_input, normalized_input, status, created_at, user_id)
         VALUES (@id, @tool, @inputKind, @rawInput, @normalizedInput, @status, @createdAt, @userId)`,
      )
      .run(record);

    return record;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .prepare("UPDATE query_tasks SET status = ? WHERE id = ?")
      .run(status, id);
  }
}
