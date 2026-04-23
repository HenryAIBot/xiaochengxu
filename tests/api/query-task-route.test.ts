import type { QueueClient } from "@xiaochengxu/queue";
import { createDefaultToolExecutor } from "@xiaochengxu/tools";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";
import { runQueryTaskProcessor } from "../../services/jobs/src/processors/query-task-processor.js";

function makeRecordingQueue(): { client: QueueClient; taskIds: string[] } {
  const taskIds: string[] = [];
  return {
    taskIds,
    client: {
      async enqueueQuery({ taskId }) {
        taskIds.push(taskId);
      },
      async enqueueNotification() {},
      async enqueueAdvisorNotification() {},
      async listFailedNotifications() {
        return [];
      },
      async retryFailedNotification() {
        return { retried: false };
      },
      async close() {},
    },
  };
}

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

describe("POST /api/query-tasks (async)", () => {
  let db = createInMemoryDb();
  let app: ReturnType<typeof buildApp> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    db.close();
    db = createInMemoryDb();
  });

  it("enqueues a task and returns 202 with pending status", async () => {
    const { client, taskIds } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "tro_alert",
        input: "https://www.amazon.com/dp/B0C1234567",
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body).toMatchObject({
      status: "pending",
      normalizedInput: { kind: "asin", normalizedValue: "B0C1234567" },
    });
    expect(body.taskId).toEqual(expect.any(String));
    expect(taskIds).toEqual([body.taskId]);

    const record = db
      .prepare("SELECT status FROM query_tasks WHERE id = ?")
      .get(body.taskId) as { status: string };
    expect(record.status).toBe("queued");
  });

  it("rejects blank input with a BLANK_INPUT 400 response", async () => {
    app = buildApp({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "case_progress", input: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "BLANK_INPUT",
      message: "输入不能为空",
    });
  });

  it("completes the task once the worker processes it", async () => {
    const { client } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "infringement_check", input: "apple" },
    });
    const { taskId } = created.json();

    const pending = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
    });
    expect(pending.json().status).toBe("queued");

    await runWorkerFor(app, taskId);

    const completed = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
    });
    expect(completed.statusCode).toBe(200);
    const body = completed.json();
    expect(body.status).toBe("completed");
    expect(body.reportId).toEqual(expect.any(String));
    expect(body.result).toMatchObject({
      level: "suspected_high",
      levelLabel: "疑似高风险",
      dataSource: "fixture",
    });
    expect(body.result.summary).toContain(
      "权利人 Apple Inc. 名下有效商标：APPLE、IPHONE、AIRPODS",
    );
  });

  it("marks a task as failed when the tool throws", async () => {
    const { client } = makeRecordingQueue();
    app = buildApp({ db, queue: client });

    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = created.json();

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
        runTool: vi
          .fn()
          .mockRejectedValue(new Error("CourtListener 服务暂时不可用")),
        postResult: async () => {},
        postFailure: async (id, error) => {
          await app.inject({
            method: "POST",
            url: `/api/internal/query-tasks/${id}/result`,
            payload: { error },
          });
        },
      },
    );

    const final = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
    });
    expect(final.json()).toMatchObject({
      status: "failed",
      failureReason: "CourtListener 服务暂时不可用",
    });
  });

  it("returns 404 for an unknown task id", async () => {
    app = buildApp({ db });
    const res = await app.inject({
      method: "GET",
      url: "/api/query-tasks/does-not-exist",
    });
    expect(res.statusCode).toBe(404);
  });
});
