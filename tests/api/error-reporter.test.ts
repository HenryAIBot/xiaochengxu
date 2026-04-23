import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, createInMemoryDb } from "../../services/api/src/app.js";
import { createSentryReporter } from "../../services/api/src/lib/error-reporter.js";

describe("error-reporter", () => {
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

  it("invokes the reporter when a route throws", async () => {
    const reports: unknown[] = [];
    app = buildApp({
      db,
      auditLog: null,
      errorReporter: (report) => {
        reports.push(report);
      },
    });

    // Register an ad-hoc throwing route so we can trigger onError.
    app.get("/boom", async () => {
      throw new Error("explosion");
    });

    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(reports.length).toBe(1);
    const report = reports[0] as {
      error: Error;
      url: string;
      method: string;
    };
    expect(report.error).toBeInstanceOf(Error);
    expect((report.error as Error).message).toBe("explosion");
    expect(report.url).toBe("/boom");
    expect(report.method).toBe("GET");
  });

  it("createSentryReporter returns stderr reporter when DSN is unset", () => {
    const captureException = vi.fn();
    const reporter = createSentryReporter({ captureException }, undefined);
    reporter({ error: new Error("noop"), url: "/x", method: "GET" });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("createSentryReporter forwards to captureException when DSN is set", () => {
    const captureException = vi.fn();
    const reporter = createSentryReporter(
      { captureException },
      "https://fake-sentry.example/1",
    );
    const err = new Error("boom");
    reporter({
      error: err,
      url: "/api/demo",
      method: "POST",
      userId: "u-1",
      context: { consultationId: "c-1" },
    });
    expect(captureException).toHaveBeenCalledOnce();
    const [capturedError, hint] = captureException.mock.calls[0] as [
      Error,
      { extra: Record<string, unknown> },
    ];
    expect(capturedError).toBe(err);
    expect(hint.extra.url).toBe("/api/demo");
    expect(hint.extra.userId).toBe("u-1");
    expect(hint.extra.consultationId).toBe("c-1");
  });
});
