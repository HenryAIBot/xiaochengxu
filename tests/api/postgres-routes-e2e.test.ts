/**
 * End-to-end route suite that runs against a real Postgres backend when
 * DATABASE_URL_TEST is set. Skipped otherwise.
 *
 * Proves that the routes migrated away from the sync sqlite handle
 * actually work when the adapter is swapped out.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../services/api/src/app.js";
import {
  type DatabaseAdapter,
  PostgresAdapter,
} from "../../services/api/src/lib/db-adapter.js";
import {
  applyPostgresSchema,
  createPostgresPool,
} from "../../services/api/src/lib/postgres.js";

const DATABASE_URL = process.env.DATABASE_URL_TEST;

describe.skipIf(!DATABASE_URL)(
  "Postgres-backed routes (requires DATABASE_URL_TEST)",
  () => {
    let pool: ReturnType<typeof createPostgresPool>;
    let db: DatabaseAdapter;
    let app: ReturnType<typeof buildApp> | null = null;

    beforeAll(async () => {
      pool = createPostgresPool(DATABASE_URL as string);
      await applyPostgresSchema(pool);
      db = new PostgresAdapter(pool);
    });

    beforeEach(async () => {
      // Truncate between tests so the seed-advisor path + isolation hold.
      await pool.query(
        "TRUNCATE consultations, advisors, leads, messages, monitors, reports, query_tasks, users RESTART IDENTITY CASCADE",
      );
    });

    afterAll(async () => {
      if (app) {
        await app.close();
        app = null;
      }
      await pool.end();
    });

    it("creates an anonymous user and authenticates subsequent requests", async () => {
      app = buildApp({ db });
      await app.ready();

      const auth = await app.inject({
        method: "POST",
        url: "/api/auth/anonymous",
      });
      expect(auth.statusCode).toBe(201);
      const { userId, token } = auth.json();

      const q = await app.inject({
        method: "POST",
        url: "/api/query-tasks",
        headers: { Authorization: `Bearer ${token}` },
        payload: { tool: "tro_alert", input: "nike" },
      });
      expect(q.statusCode).toBe(202);

      const task = await pool.query<{ user_id: string }>(
        "SELECT user_id FROM query_tasks WHERE id = $1",
        [q.json().taskId],
      );
      expect(task.rows[0].user_id).toBe(userId);

      await app.close();
      app = null;
    });

    it("auto-assigns a consultation and stores advisor_id", async () => {
      app = buildApp({ db });
      await app.ready();

      const auth = await app.inject({
        method: "POST",
        url: "/api/auth/anonymous",
      });
      const { token } = auth.json();

      const consult = await app.inject({
        method: "POST",
        url: "/api/consultations",
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: "Alice",
          phone: "+15550000100",
          targetRef: { kind: "brand", value: "nike" },
          sourceReportId: "r-1",
        },
      });
      expect(consult.statusCode).toBe(201);
      expect(consult.json().status).toBe("assigned");
      expect(consult.json().advisorId).toEqual(expect.any(String));

      const list = await app.inject({
        method: "GET",
        url: "/api/consultations",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect((list.json().items as unknown[]).length).toBe(1);
      const item = (list.json().items as Array<Record<string, unknown>>)[0];
      expect(item.targetRef).toEqual({ kind: "brand", value: "nike" });
      expect(item.advisor).toEqual(expect.any(String));

      await app.close();
      app = null;
    });

    it("round-trips a full query → report → unlock flow", async () => {
      app = buildApp({ db });
      await app.ready();

      const auth = await app.inject({
        method: "POST",
        url: "/api/auth/anonymous",
      });
      const { token } = auth.json();

      const q = await app.inject({
        method: "POST",
        url: "/api/query-tasks",
        headers: { Authorization: `Bearer ${token}` },
        payload: { tool: "tro_alert", input: "nike" },
      });
      const { taskId } = q.json();

      // Simulate worker write-back (bypasses the queue).
      const writeback = await app.inject({
        method: "POST",
        url: `/api/internal/query-tasks/${taskId}/result`,
        payload: {
          report: {
            level: "suspected_high",
            summary: "test summary",
            evidence: [{ source: "amazon", level: "watch", reason: "r" }],
            recommendedActions: ["立即复核"],
            dataSource: "fixture",
          },
        },
      });
      expect(writeback.statusCode).toBe(200);
      const { reportId } = writeback.json();

      const fetched = await app.inject({
        method: "GET",
        url: `/api/query-tasks/${taskId}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(fetched.statusCode).toBe(200);
      expect(fetched.json().status).toBe("completed");
      expect(fetched.json().reportId).toBe(reportId);

      const unlock = await app.inject({
        method: "POST",
        url: `/api/reports/${reportId}/unlock`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { phone: "+15279825102" },
      });
      expect(unlock.statusCode).toBe(200);
      expect(unlock.json().unlocked).toBe(true);

      const detail = await app.inject({
        method: "GET",
        url: `/api/reports/${reportId}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().unlocked).toBe(true);
      expect(detail.json().preview.level).toBe("suspected_high");
      expect(detail.json().preview.evidence).toEqual([
        { source: "amazon", level: "watch", reason: "r" },
      ]);
      expect(detail.json().preview.recommendedActions).toEqual(["立即复核"]);

      await app.close();
      app = null;
    });

    it("isolates monitors across users", async () => {
      app = buildApp({ db });
      await app.ready();

      const aliceAuth = await app.inject({
        method: "POST",
        url: "/api/auth/anonymous",
      });
      const bobAuth = await app.inject({
        method: "POST",
        url: "/api/auth/anonymous",
      });

      await app.inject({
        method: "POST",
        url: "/api/monitors",
        headers: { Authorization: `Bearer ${aliceAuth.json().token}` },
        payload: { targetKind: "brand", targetValue: "nike" },
      });
      await app.inject({
        method: "POST",
        url: "/api/monitors",
        headers: { Authorization: `Bearer ${bobAuth.json().token}` },
        payload: { targetKind: "brand", targetValue: "adidas" },
      });

      const aliceList = await app.inject({
        method: "GET",
        url: "/api/monitors",
        headers: { Authorization: `Bearer ${aliceAuth.json().token}` },
      });
      const aliceValues = (
        aliceList.json().items as Array<{ targetValue: string }>
      ).map((m) => m.targetValue);
      expect(aliceValues).toEqual(["nike"]);

      await app.close();
      app = null;
    });
  },
);
