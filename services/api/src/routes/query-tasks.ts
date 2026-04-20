import {
  BlankInputError,
  type NormalizedInput,
  type ToolName,
  normalizeInput,
} from "@xiaochengxu/core";
import type { FastifyInstance } from "fastify";
import { QueryTaskRepository } from "../repositories/query-task-repository.js";

interface QueryTaskBody {
  tool: ToolName;
  input: string;
}

const TOOL_NAMES = new Set<ToolName>([
  "infringement_check",
  "tro_alert",
  "case_progress",
]);

function isQueryTaskBody(body: unknown): body is QueryTaskBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.tool === "string" &&
    TOOL_NAMES.has(candidate.tool as ToolName) &&
    typeof candidate.input === "string"
  );
}

export async function registerQueryTaskRoutes(app: FastifyInstance) {
  app.post("/api/query-tasks", async (request, reply) => {
    if (!isQueryTaskBody(request.body)) {
      return reply.code(400).send({
        code: "INVALID_REQUEST",
        message: "Request body must include tool and input",
      });
    }

    const repository = new QueryTaskRepository(app.db);
    let normalizedInput: NormalizedInput;

    try {
      normalizedInput = normalizeInput(request.body.input);
    } catch (error) {
      if (error instanceof BlankInputError) {
        return reply.code(400).send({
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    const task = repository.create({
      tool: request.body.tool,
      rawInput: request.body.input,
      normalizedInput,
    });

    return reply.code(202).send({
      id: task.id,
      status: task.status,
      normalizedInput,
    });
  });
}
