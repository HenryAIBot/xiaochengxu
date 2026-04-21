import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";

describe("POST /api/query-tasks", () => {
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

  it("stores a normalized completed task and creates a report preview", async () => {
    app = buildApp({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "tro_alert",
        input: "https://www.amazon.com/dp/B0C1234567",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      normalizedInput: {
        kind: "asin",
        normalizedValue: "B0C1234567",
      },
      level: "watch",
      levelLabel: "需关注",
    });
    expect(response.json().reportId).toEqual(expect.any(String));
    expect(response.json().summary).toContain("B0C1234567");

    const record = db
      .prepare(
        `SELECT tool, input_kind AS inputKind, raw_input AS rawInput, normalized_input AS normalizedInput, status
         FROM query_tasks`,
      )
      .get() as {
      tool: string;
      inputKind: string;
      rawInput: string;
      normalizedInput: string;
      status: string;
    };

    expect(record).toMatchObject({
      tool: "tro_alert",
      inputKind: "asin",
      rawInput: "https://www.amazon.com/dp/B0C1234567",
      normalizedInput: "B0C1234567",
      status: "completed",
    });

    const report = db
      .prepare(
        "SELECT task_id AS taskId, level, summary, unlocked FROM reports",
      )
      .get() as {
      taskId: string;
      level: string;
      summary: string;
      unlocked: number;
    };

    expect(report).toMatchObject({
      level: "watch",
      unlocked: 0,
    });
    expect(report.taskId).toEqual(response.json().id);
  });

  it("rejects blank input with a BLANK_INPUT 400 response", async () => {
    app = buildApp({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "case_progress",
        input: "   ",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "BLANK_INPUT",
      message: "输入不能为空",
    });
  });

  it("checks brand terms directly for infringement risk", async () => {
    app = buildApp({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "infringement_check",
        input: "apple",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      level: "suspected_high",
      levelLabel: "疑似高风险",
      normalizedInput: {
        kind: "brand",
        normalizedValue: "apple",
      },
    });
    expect(response.json().summary).toContain(
      "权利人 Apple Inc. 名下有效商标：APPLE、IPHONE、AIRPODS",
    );
    expect(response.json().evidence).toHaveLength(1);
  });
});
