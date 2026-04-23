#!/usr/bin/env node
/**
 * Apply the canonical Postgres schema to a running database. Usage:
 *
 *   DATABASE_URL=postgres://user:pass@host:5432/db \
 *     pnpm --filter @xiaochengxu/api exec tsx src/scripts/apply-postgres-schema.ts
 *
 * The schema is idempotent (CREATE TABLE/INDEX IF NOT EXISTS) so it is
 * safe to run on every deploy.
 */
import { applyPostgresSchema, createPostgresPool } from "../lib/postgres.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Set it to a postgres:// connection string.",
    );
    process.exit(1);
  }
  const pool = createPostgresPool(url);
  try {
    await applyPostgresSchema(pool);
    console.log("Postgres schema applied successfully.");
  } catch (error) {
    console.error("Failed to apply schema:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
