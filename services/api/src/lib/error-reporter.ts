/**
 * Vendor-neutral error reporter. Consumers wire this into Fastify's
 * `onError` hook so that runtime errors reach their observability stack
 * (Sentry / OpenTelemetry / Datadog / whatever) without hard-coding a
 * specific SDK into the API package.
 *
 * The default behaviour is to log to stderr as a structured JSON line so
 * that even without an external service you still get every error in
 * your container logs.
 */
export interface ErrorReport {
  error: unknown;
  /** Fastify route URL when available. */
  url?: string;
  /** HTTP method when available. */
  method?: string;
  /** Authenticated user id when available. */
  userId?: string | null;
  /** Arbitrary structured metadata the route wants to attach. */
  context?: Record<string, unknown>;
}

export type ErrorReporter = (report: ErrorReport) => void;

function serializeError(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: (error as { code?: string }).code,
    };
  }
  return { message: String(error) };
}

export const stderrReporter: ErrorReporter = (report) => {
  const line = {
    kind: "error",
    at: new Date().toISOString(),
    url: report.url,
    method: report.method,
    userId: report.userId ?? null,
    context: report.context ?? null,
    ...serializeError(report.error),
  };
  process.stderr.write(`${JSON.stringify(line)}\n`);
};

/**
 * Create a Sentry-compatible adapter. Accepts the runtime Sentry module
 * so the API package itself never depends on `@sentry/node`. Returns a
 * no-op when `dsn` is falsy so the same wiring can be used in dev/test.
 *
 *   import * as Sentry from "@sentry/node";
 *   Sentry.init({ dsn: process.env.SENTRY_DSN });
 *   buildApp({ errorReporter: createSentryReporter(Sentry, process.env.SENTRY_DSN) });
 */
export function createSentryReporter(
  sentryLike: {
    captureException: (
      error: unknown,
      hint?: { extra?: Record<string, unknown>; tags?: Record<string, string> },
    ) => void;
  },
  dsn: string | undefined,
): ErrorReporter {
  if (!dsn) return stderrReporter;
  return (report) => {
    try {
      sentryLike.captureException(report.error, {
        extra: {
          url: report.url,
          method: report.method,
          userId: report.userId,
          ...(report.context ?? {}),
        },
      });
    } catch {
      // never let the reporter itself throw — fall back to stderr
      stderrReporter(report);
    }
    // Also mirror to stderr so container logs stay useful.
    stderrReporter(report);
  };
}
