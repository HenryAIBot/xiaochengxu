import { createDefaultToolExecutor } from "@xiaochengxu/tools";
import type { FastifyInstance } from "fastify";
import { runQueryTaskProcessor } from "../../services/jobs/src/processors/query-task-processor.js";

export async function processQueryTask(
  app: FastifyInstance,
  taskId: string,
): Promise<void> {
  const runTool = createDefaultToolExecutor();
  await runQueryTaskProcessor(
    { taskId },
    {
      loadTask: async (id) => {
        const r = await app.inject({
          method: "GET",
          url: `/api/internal/query-tasks/${id}/raw`,
        });
        return r.json();
      },
      runTool: (task) =>
        runTool({ tool: task.tool, normalizedInput: task.normalizedInput }),
      postResult: async (id, result) => {
        await app.inject({
          method: "POST",
          url: `/api/internal/query-tasks/${id}/result`,
          payload: { report: result },
        });
      },
      postFailure: async (id, error) => {
        await app.inject({
          method: "POST",
          url: `/api/internal/query-tasks/${id}/result`,
          payload: { error },
        });
      },
    },
  );
}

export async function createAndProcessQuery(
  app: FastifyInstance,
  payload: { tool: string; input: string },
): Promise<{ taskId: string; reportId: string }> {
  const created = await app.inject({
    method: "POST",
    url: "/api/query-tasks",
    payload,
  });
  if (created.statusCode !== 202) {
    throw new Error(
      `query task creation failed: ${created.statusCode} ${created.body}`,
    );
  }
  const { taskId } = created.json();
  await processQueryTask(app, taskId);

  const completed = await app.inject({
    method: "GET",
    url: `/api/query-tasks/${taskId}`,
  });
  const body = completed.json();
  if (body.status !== "completed") {
    throw new Error(`query task did not complete: status=${body.status}`);
  }
  return { taskId, reportId: body.reportId };
}
