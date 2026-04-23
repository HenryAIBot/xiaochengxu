import type { QueueClient } from "@xiaochengxu/queue";
import { createDefaultToolExecutor } from "@xiaochengxu/tools";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";
import { runQueryTaskProcessor } from "../../services/jobs/src/processors/query-task-processor.js";

async function runWorkerFor(app: ReturnType<typeof buildApp>, taskId: string) {
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

describe("query flow (end to end)", () => {
  let db = createInMemoryDb();
  let app: ReturnType<typeof buildApp> | null = null;
  const enqueuedTaskIds: string[] = [];
  const queue: QueueClient = {
    async enqueueQuery({ taskId }) {
      enqueuedTaskIds.push(taskId);
    },
    async enqueueNotification() {},
    async enqueueAdvisorNotification() {},
    async close() {},
  };

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    enqueuedTaskIds.length = 0;
    db.close();
    db = createInMemoryDb();
  });

  it("enqueues → processes → unlocks → monitors", async () => {
    app = buildApp({ db, queue });

    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });
    expect(created.statusCode).toBe(202);
    const { taskId } = created.json();
    expect(enqueuedTaskIds).toEqual([taskId]);

    await runWorkerFor(app, taskId);

    const completed = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
    });
    expect(completed.json()).toMatchObject({
      status: "completed",
      result: { level: "suspected_high" },
    });
    const reportId = completed.json().reportId as string;

    const unlock = await app.inject({
      method: "POST",
      url: `/api/reports/${reportId}/unlock`,
      payload: { email: "seller@example.com" },
    });
    expect(unlock.statusCode).toBe(200);

    const fullReport = await app.inject({
      method: "GET",
      url: unlock.json().fullReportUrl,
    });
    expect(fullReport.json()).toMatchObject({
      unlocked: true,
      query: { tool: "tro_alert", normalizedInput: "nike" },
      preview: { level: "suspected_high" },
    });

    const monitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        targetKind: "brand",
        targetValue: "nike",
        notifyEmail: "seller@example.com",
      },
    });
    expect(monitor.json()).toMatchObject({
      targetValue: "nike",
      status: "active",
    });
  });
});
