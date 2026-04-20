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

  it("stores a normalized queued task", async () => {
    app = buildApp({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/query-tasks",
      payload: {
        tool: "tro_alert",
        input: "https://www.amazon.com/dp/B0C1234567",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "queued",
      normalizedInput: {
        kind: "asin",
        normalizedValue: "B0C1234567",
      },
    });

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
      status: "queued",
    });
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
      message: "Input cannot be blank",
    });
  });
});
