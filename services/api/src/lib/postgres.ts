import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool as PgPool, type Pool, type PoolConfig } from "pg";

/**
 * Create a PostgreSQL connection pool from a DATABASE_URL. Falls back to
 * individual env vars (PGHOST / PGUSER / etc.) when connectionString is
 * not provided — see https://node-postgres.com/features/connecting.
 */
export function createPostgresPool(options: PoolConfig | string): Pool {
  if (typeof options === "string") {
    return new PgPool({ connectionString: options });
  }
  return new PgPool(options);
}

/**
 * Apply the canonical schema DDL to the pool. Idempotent — safe to call
 * on every boot. Uses `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF
 * NOT EXISTS` throughout.
 */
export async function applyPostgresSchema(pool: Pool): Promise<void> {
  const schemaPath = fileURLToPath(
    new URL("./postgres-schema.sql", import.meta.url),
  );
  const sql = readFileSync(schemaPath, "utf-8");
  await pool.query(sql);
}

/**
 * Rewrite positional `?` placeholders (sqlite style) into `$1, $2, ...`
 * (Postgres style). Does not handle `?` inside single-quoted string
 * literals — our generated SQL never contains those, but if you pass
 * arbitrary user input into raw SQL, parameterize it instead.
 */
export function rewritePlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * Convenience helper: run a parameterized query against a Pool,
 * rewriting `?` placeholders. Matches the calling convention used by
 * the existing better-sqlite3 prepared-statement sites so the route
 * layer can migrate one query at a time.
 */
export async function pgAll<T = Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(rewritePlaceholders(sql), params);
  return result.rows as T[];
}

export async function pgGet<T = Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const result = await pool.query(rewritePlaceholders(sql), params);
  return (result.rows[0] as T | undefined) ?? undefined;
}

export async function pgRun(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<{ rowCount: number }> {
  const result = await pool.query(rewritePlaceholders(sql), params);
  return { rowCount: result.rowCount ?? 0 };
}
