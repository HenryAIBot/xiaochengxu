import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

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

  it("unlocks a report, creates a monitor, and lists storefront candidates", async () => {
    app = buildApp({ db });

    const unlock = await app.inject({
      method: "POST",
      url: "/api/reports/report-1/unlock",
      payload: {
        email: "seller@example.com",
        phone: "+15551234567",
      },
    });

    expect(unlock.statusCode).toBe(200);
    expect(unlock.json()).toMatchObject({
      id: "report-1",
      unlocked: true,
      fullReportUrl: "/api/reports/report-1",
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
    expect(monitor.json()).toMatchObject({
      status: "active",
      targetKind: "brand",
      targetValue: "nike",
      notifyEmail: "seller@example.com",
    });

    const leadRecord = db
      .prepare(
        "SELECT email, phone FROM leads ORDER BY created_at DESC LIMIT 1",
      )
      .get() as { email: string | null; phone: string | null };
    expect(leadRecord).toMatchObject({
      email: "seller@example.com",
      phone: "+15551234567",
    });

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
});
