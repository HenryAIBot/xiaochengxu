import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyPostgresSchema,
  createPostgresPool,
  pgAll,
  pgGet,
  pgRun,
  rewritePlaceholders,
} from "../../services/api/src/lib/postgres.js";

/**
 * Placeholder rewrite is a pure function and always tested.
 * The full DDL + connection test is skipped unless DATABASE_URL_TEST
 * points at a reachable Postgres instance (so CI without docker still
 * passes; a developer running `docker compose up postgres` gets full
 * coverage).
 */

describe("rewritePlaceholders (pure)", () => {
  it("rewrites ? into $1, $2, …", () => {
    expect(rewritePlaceholders("SELECT ?")).toBe("SELECT $1");
    expect(rewritePlaceholders("INSERT INTO t(a, b, c) VALUES (?, ?, ?)")).toBe(
      "INSERT INTO t(a, b, c) VALUES ($1, $2, $3)",
    );
  });

  it("is idempotent for queries without placeholders", () => {
    expect(rewritePlaceholders("SELECT 1")).toBe("SELECT 1");
  });
});

const DATABASE_URL = process.env.DATABASE_URL_TEST;

describe.skipIf(!DATABASE_URL)(
  "Postgres schema (requires DATABASE_URL_TEST)",
  () => {
    let pool: ReturnType<typeof createPostgresPool>;

    beforeAll(async () => {
      pool = createPostgresPool(DATABASE_URL as string);
      await applyPostgresSchema(pool);
      // Clean up rows that may linger from earlier test runs.
      await pool.query("DELETE FROM consultations");
      await pool.query("DELETE FROM advisors");
      await pool.query("DELETE FROM users");
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates all core tables", async () => {
      const tables = await pool.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      );
      const names = tables.rows.map((r) => r.table_name);
      expect(names).toEqual(
        expect.arrayContaining([
          "users",
          "query_tasks",
          "reports",
          "leads",
          "monitors",
          "messages",
          "advisors",
          "consultations",
        ]),
      );
    });

    it("round-trips a user with wechat_openid via pgRun + pgGet", async () => {
      const id = randomUUID();
      const token = `t_${id.slice(0, 8)}`;
      await pgRun(
        pool,
        "INSERT INTO users (id, token, wechat_openid) VALUES (?, ?, ?)",
        [id, token, `o_smoke_${id.slice(0, 8)}`],
      );
      const row = await pgGet<{ id: string; token: string }>(
        pool,
        "SELECT id, token FROM users WHERE id = ?",
        [id],
      );
      expect(row?.token).toBe(token);
    });

    it("enforces wechat_openid uniqueness", async () => {
      const openid = "o_unique_test";
      await pgRun(
        pool,
        "INSERT INTO users (id, token, wechat_openid) VALUES (?, ?, ?)",
        [randomUUID(), "tok1", openid],
      );
      await expect(
        pgRun(
          pool,
          "INSERT INTO users (id, token, wechat_openid) VALUES (?, ?, ?)",
          [randomUUID(), "tok2", openid],
        ),
      ).rejects.toThrow();
    });

    it("pgAll returns array of rows", async () => {
      const rows = await pgAll<{ id: string }>(pool, "SELECT id FROM users");
      expect(Array.isArray(rows)).toBe(true);
    });
  },
);
