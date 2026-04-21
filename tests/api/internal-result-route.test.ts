import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("POST /api/internal/query-tasks/:id/result", () => {
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

  it("writes a report and marks the task completed", async () => {
    app = buildApp({ db });

    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "nike" },
    });
    const { taskId } = created.json();

    const write = await app.inject({
      method: "POST",
      url: `/api/internal/query-tasks/${taskId}/result`,
      payload: {
        report: {
          level: "suspected_high",
          summary: "监控命中 Nike 相关 TRO。",
          evidence: [
            {
              source: "courtlistener",
              level: "suspected_high",
              reason: "Nike v. Wu",
            },
          ],
          recommendedActions: ["立即联系顾问"],
          dataSource: "fixture",
        },
      },
    });

    expect(write.statusCode).toBe(200);
    const written = write.json();
    expect(written).toMatchObject({
      taskId,
      status: "completed",
    });
    expect(written.reportId).toEqual(expect.any(String));

    const fetched = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
    });
    expect(fetched.json()).toMatchObject({
      status: "completed",
      reportId: written.reportId,
      result: {
        level: "suspected_high",
        dataSource: "fixture",
      },
    });
  });

  it("marks the task failed when an error is posted", async () => {
    app = buildApp({ db });

    const created = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: { tool: "tro_alert", input: "adidas" },
    });
    const { taskId } = created.json();

    await app.inject({
      method: "POST",
      url: `/api/internal/query-tasks/${taskId}/result`,
      payload: { error: "CourtListener 不可达" },
    });

    const fetched = await app.inject({
      method: "GET",
      url: `/api/query-tasks/${taskId}`,
    });
    expect(fetched.json()).toMatchObject({
      status: "failed",
      failureReason: "CourtListener 不可达",
    });
  });

  it("returns 404 for an unknown task id", async () => {
    app = buildApp({ db });
    const r = await app.inject({
      method: "POST",
      url: "/api/internal/query-tasks/does-not-exist/result",
      payload: { error: "x" },
    });
    expect(r.statusCode).toBe(404);
  });
});
