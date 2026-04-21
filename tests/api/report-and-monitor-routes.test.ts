import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";
import { createAndProcessQuery } from "../helpers/run-worker.js";

describe("report unlock and monitor routes", () => {
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

  it("unlocks an existing report, creates a monitor, and lists storefront candidates", async () => {
    app = buildApp({ db });

    const { taskId, reportId } = await createAndProcessQuery(app, {
      tool: "tro_alert",
      input: "nike",
    });

    const unlock = await app.inject({
      method: "POST",
      url: `/api/reports/${reportId}/unlock`,
      payload: { email: "seller@example.com", phone: "+15551234567" },
    });

    expect(unlock.statusCode).toBe(200);
    expect(unlock.json()).toMatchObject({
      id: reportId,
      unlocked: true,
      fullReportUrl: `/api/reports/${reportId}`,
    });

    const fullReport = await app.inject({
      method: "GET",
      url: `/api/reports/${reportId}`,
    });

    expect(fullReport.statusCode).toBe(200);
    expect(fullReport.json()).toMatchObject({
      id: reportId,
      unlocked: true,
      preview: {
        level: "suspected_high",
        summary: expect.stringContaining("Nike"),
      },
      query: {
        tool: "tro_alert",
        inputKind: "brand",
        normalizedInput: "nike",
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

    expect(monitor.statusCode).toBe(201);
    const monitorId = monitor.json().id as string;
    expect(monitor.json()).toMatchObject({
      status: "active",
      targetKind: "brand",
      targetValue: "nike",
      notifyEmail: "seller@example.com",
    });

    const monitors = await app.inject({
      method: "GET",
      url: "/api/monitors",
    });

    expect(monitors.statusCode).toBe(200);
    expect(monitors.json()).toMatchObject({
      items: [
        {
          id: monitorId,
          status: "active",
          targetKind: "brand",
          targetValue: "nike",
          notifyEmail: "seller@example.com",
        },
      ],
    });

    const leadRecord = db
      .prepare(
        `SELECT email, phone, source_report_id AS sourceReportId, source_task_id AS sourceTaskId,
                source_tool AS sourceTool, source_input AS sourceInput
         FROM leads ORDER BY created_at DESC LIMIT 1`,
      )
      .get() as {
      email: string | null;
      phone: string | null;
      sourceReportId: string | null;
      sourceTaskId: string | null;
      sourceTool: string | null;
      sourceInput: string | null;
    };
    expect(leadRecord).toMatchObject({
      email: "seller@example.com",
      phone: "+15551234567",
      sourceReportId: reportId,
      sourceTaskId: taskId,
      sourceTool: "tro_alert",
      sourceInput: "nike",
    });

    const reportRecord = db
      .prepare("SELECT unlocked FROM reports WHERE id = ?")
      .get(reportId) as { unlocked: number };
    expect(reportRecord.unlocked).toBe(1);

    const monitorRecord = db
      .prepare(
        `SELECT target_kind AS targetKind, target_value AS targetValue, notify_email AS notifyEmail, status
         FROM monitors`,
      )
      .get() as {
      targetKind: string;
      targetValue: string;
      notifyEmail: string | null;
      status: string;
    };
    expect(monitorRecord).toMatchObject({
      targetKind: "brand",
      targetValue: "nike",
      notifyEmail: "seller@example.com",
      status: "active",
    });

    const storefront = await app.inject({
      method: "GET",
      url: "/api/storefronts/nike%20store/products",
    });

    expect(storefront.statusCode).toBe(200);
    expect(storefront.json()).toMatchObject({
      items: [{ asin: "B0C1234567" }, { asin: "B0C7654321" }],
    });
  });

  it("rejects report unlock without contact information", async () => {
    app = buildApp({ db });

    const { reportId } = await createAndProcessQuery(app, {
      tool: "tro_alert",
      input: "nike",
    });

    const unlock = await app.inject({
      method: "POST",
      url: `/api/reports/${reportId}/unlock`,
      payload: {},
    });

    expect(unlock.statusCode).toBe(400);
    expect(unlock.json()).toMatchObject({
      code: "CONTACT_REQUIRED",
      message: "请输入邮箱或手机号",
    });
  });
});
