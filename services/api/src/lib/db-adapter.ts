/**
 * Dialect-neutral database adapter.
 *
 * Routes call `db.prepare(sql).run/all/get(...params)`. Params can be:
 *   - positional: plain values, matching `?` placeholders, OR
 *   - named: a single plain-object arg matching `@name` placeholders.
 *
 * The SQLite adapter is a thin `Promise.resolve` wrapper around
 * better-sqlite3 (synchronous under the hood). The Postgres adapter
 * rewrites `?` / `@name` into `$N` and extracts params in the right order
 * before delegating to a `pg.Pool`.
 *
 * Public surface is fully async so routes that `await` each call work
 * against either backend with zero code changes.
 */
import type Database from "better-sqlite3";
import type { Pool } from "pg";
import { rewritePlaceholders } from "./postgres.js";

export interface RunResult {
  rowCount: number;
  lastInsertId?: number | bigint;
}

export interface PreparedStatement {
  run(...params: unknown[]): Promise<RunResult>;
  all<R = Record<string, unknown>>(...params: unknown[]): Promise<R[]>;
  get<R = Record<string, unknown>>(
    ...params: unknown[]
  ): Promise<R | undefined>;
}

export interface DatabaseAdapter {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  /** Backend dialect — useful when a query needs to branch. */
  readonly dialect: "sqlite" | "postgres";
}

// ─── SQLite adapter ─────────────────────────────────────────────────────

class SqliteStatement implements PreparedStatement {
  constructor(private readonly stmt: Database.Statement) {}

  async run(...params: unknown[]): Promise<RunResult> {
    const info = this.invoke("run", params) as Database.RunResult;
    return {
      rowCount: info.changes,
      lastInsertId: info.lastInsertRowid,
    };
  }

  async all<R>(...params: unknown[]): Promise<R[]> {
    return this.invoke("all", params) as R[];
  }

  async get<R>(...params: unknown[]): Promise<R | undefined> {
    return this.invoke("get", params) as R | undefined;
  }

  private invoke(method: "run" | "all" | "get", params: unknown[]) {
    // better-sqlite3's API: pass the array spread for positional params,
    // OR a single object for named (@name) params. We just forward.
    const stmt = this.stmt as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    return stmt[method].apply(this.stmt, params);
  }
}

export class SqliteAdapter implements DatabaseAdapter {
  readonly dialect = "sqlite" as const;
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): PreparedStatement {
    return new SqliteStatement(this.db.prepare(sql));
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  /** Escape hatch for ensureColumn-style schema evolution that needs
   * the raw better-sqlite3 handle. */
  getUnderlying(): Database.Database {
    return this.db;
  }
}

// ─── Postgres adapter ───────────────────────────────────────────────────

interface PreparedPg {
  sql: string;
  /** Null for fully positional queries. Otherwise the ordered list of
   * named-parameter keys (without the `@`) that appear in the SQL. */
  namedKeys: string[] | null;
}

/**
 * Translate a sqlite-style query into Postgres.
 *
 *   "SELECT * FROM users WHERE token = ?" → no namedKeys, ? → $1
 *   "INSERT ... VALUES (@id, @token)"     → namedKeys=["id","token"], @id → $1
 */
function preparePg(sql: string): PreparedPg {
  const namedMatches = [...sql.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)];
  if (namedMatches.length === 0) {
    return { sql: rewritePlaceholders(sql), namedKeys: null };
  }
  // Build ordered list of distinct param names (first occurrence wins).
  const order: string[] = [];
  const indexOf = new Map<string, number>();
  for (const m of namedMatches) {
    const name = m[1];
    if (!indexOf.has(name)) {
      indexOf.set(name, order.length);
      order.push(name);
    }
  }
  const rewritten = sql.replace(
    /@([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, name: string) => `$${(indexOf.get(name) ?? 0) + 1}`,
  );
  return { sql: rewritten, namedKeys: order };
}

function extractParams(prepared: PreparedPg, callArgs: unknown[]): unknown[] {
  // Named param style: single plain-object arg.
  if (
    prepared.namedKeys &&
    callArgs.length === 1 &&
    callArgs[0] !== null &&
    typeof callArgs[0] === "object" &&
    !Array.isArray(callArgs[0])
  ) {
    const obj = callArgs[0] as Record<string, unknown>;
    return prepared.namedKeys.map((key) => obj[key] ?? null);
  }
  // Positional: flatten a single spread-array-of-values if passed as one
  // array (`.run(arr)` vs `.run(...arr)`), matching better-sqlite3 behaviour.
  if (callArgs.length === 1 && Array.isArray(callArgs[0])) {
    return callArgs[0] as unknown[];
  }
  return callArgs;
}

class PgStatement implements PreparedStatement {
  constructor(
    private readonly pool: Pool,
    private readonly prepared: PreparedPg,
  ) {}

  async run(...params: unknown[]): Promise<RunResult> {
    const result = await this.pool.query(
      this.prepared.sql,
      extractParams(this.prepared, params),
    );
    return { rowCount: result.rowCount ?? 0 };
  }

  async all<R>(...params: unknown[]): Promise<R[]> {
    const result = await this.pool.query(
      this.prepared.sql,
      extractParams(this.prepared, params),
    );
    return result.rows as R[];
  }

  async get<R>(...params: unknown[]): Promise<R | undefined> {
    const result = await this.pool.query(
      this.prepared.sql,
      extractParams(this.prepared, params),
    );
    return (result.rows[0] as R | undefined) ?? undefined;
  }
}

export class PostgresAdapter implements DatabaseAdapter {
  readonly dialect = "postgres" as const;
  constructor(private readonly pool: Pool) {}

  prepare(sql: string): PreparedStatement {
    return new PgStatement(this.pool, preparePg(sql));
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /** Exposed so callers can share the underlying pg.Pool (e.g., for
   *  one-off queries that don't fit the PreparedStatement shape). */
  getUnderlying(): Pool {
    return this.pool;
  }
}

/** Visible to tests that want to assert the placeholder rewrite. */
export const _internals = { preparePg, extractParams };
