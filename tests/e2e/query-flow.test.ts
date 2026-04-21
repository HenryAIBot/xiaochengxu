import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("query flow", () => {
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

  it("creates a task, unlocks a report, and starts a monitor", async () => {
    app = buildApp({ db });

    const query = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "tro_alert",
        input: "nike",
      },
    });

    expect(query.statusCode).toBe(200);
    expect(query.json()).toMatchObject({
      status: "completed",
      level: "suspected_high",
    });

    const unlock = await app.inject({
      method: "POST",
      url: `/api/reports/${query.json().reportId}/unlock`,
      payload: {
        email: "seller@example.com",
      },
    });

    expect(unlock.statusCode).toBe(200);

    const fullReport = await app.inject({
      method: "GET",
      url: unlock.json().fullReportUrl,
    });

    expect(fullReport.statusCode).toBe(200);
    expect(fullReport.json()).toMatchObject({
      unlocked: true,
      query: {
        tool: "tro_alert",
        normalizedInput: "nike",
      },
      preview: {
        level: "suspected_high",
      },
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
