import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  type DatabaseAdapter,
  PostgresAdapter,
  SqliteAdapter,
} from "./db-adapter.js";
import { applyPostgresSchema, createPostgresPool } from "./postgres.js";

export type QueryTaskDatabase = Database.Database;

export function resolveDefaultQueryTaskDatabasePath() {
  return fileURLToPath(
    new URL("../../data/query-tasks.sqlite", import.meta.url),
  );
}

const DEFAULT_DB_PATH = resolveDefaultQueryTaskDatabasePath();

function ensureColumn(
  db: QueryTaskDatabase,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function initializeSchema(db: QueryTaskDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_tasks (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      input_kind TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      normalized_input TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      level TEXT NOT NULL,
      summary TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      recommended_actions_json TEXT NOT NULL DEFAULT '[]',
      extra_json TEXT,
      unlocked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      source_report_id TEXT,
      source_task_id TEXT,
      source_tool TEXT,
      source_input TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      target_kind TEXT NOT NULL,
      target_value TEXT NOT NULL,
      notify_email TEXT,
      notify_phone TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      wechat_openid TEXT UNIQUE,
      wechat_union_id TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      advisor TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      specialty TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, "reports", "evidence_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(
    db,
    "reports",
    "recommended_actions_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  ensureColumn(db, "reports", "extra_json", "TEXT");
  ensureColumn(db, "leads", "source_report_id", "TEXT");
  ensureColumn(db, "leads", "source_task_id", "TEXT");
  ensureColumn(db, "leads", "source_tool", "TEXT");
  ensureColumn(db, "leads", "source_input", "TEXT");
  ensureColumn(db, "messages", "monitor_id", "TEXT");
  ensureColumn(db, "messages", "level", "TEXT");
  ensureColumn(db, "messages", "to_address", "TEXT");
  ensureColumn(db, "query_tasks", "failure_reason", "TEXT");
  ensureColumn(db, "query_tasks", "updated_at", "TEXT");
  ensureColumn(db, "reports", "data_source", "TEXT");
  ensureColumn(db, "reports", "created_at", "TEXT");
  ensureColumn(db, "reports", "source_fetched_at", "TEXT");
  ensureColumn(db, "monitors", "last_preview_level", "TEXT");
  ensureColumn(db, "monitors", "last_preview_summary", "TEXT");
  ensureColumn(db, "monitors", "last_checked_at", "TEXT");
  ensureColumn(db, "query_tasks", "user_id", "TEXT");
  ensureColumn(db, "monitors", "user_id", "TEXT");
  ensureColumn(db, "leads", "user_id", "TEXT");
  ensureColumn(db, "users", "wechat_openid", "TEXT");
  ensureColumn(db, "users", "wechat_union_id", "TEXT");
  ensureColumn(db, "consultations", "advisor_id", "TEXT");
  ensureColumn(db, "consultations", "target_ref_kind", "TEXT");
  ensureColumn(db, "consultations", "target_ref_value", "TEXT");
  ensureColumn(db, "consultations", "source_report_id", "TEXT");
  ensureColumn(db, "consultations", "source_query_task_id", "TEXT");
  ensureColumn(db, "advisors", "last_assigned_at", "TEXT");
  try {
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_openid ON users(wechat_openid) WHERE wechat_openid IS NOT NULL",
    );
  } catch {
    // SQLite ignores partial index create failures if syntax unsupported; ignore
  }
}

function openDatabase(filePath: string) {
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  initializeSchema(db);
  return db;
}

function isStaleConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return (
    code === "SQLITE_READONLY_DBMOVED" ||
    code === "SQLITE_IOERR_READ" ||
    code === "SQLITE_IOERR" ||
    code === "SQLITE_CORRUPT"
  );
}

/**
 * Wrap the sqlite connection so that if the underlying file gets
 * replaced out from under us (e.g. developer deletes or `git checkout`s
 * the db during `tsx watch`) we transparently reopen it and retry the
 * operation once. In-memory databases can't move, so they bypass the
 * resilience layer.
 */
function wrapResilient(
  filePath: string,
  initialDb: QueryTaskDatabase,
): QueryTaskDatabase {
  if (filePath === ":memory:") return initialDb;

  let current = initialDb;

  const reopen = (reason: unknown) => {
    try {
      current.close();
    } catch {
      // ignore close errors on already-broken connection
    }
    console.warn(
      "[api] reopening sqlite connection after transient error:",
      (reason as { code?: string })?.code ?? reason,
    );
    current = openDatabase(filePath);
  };

  // biome-ignore lint/suspicious/noExplicitAny: native statement object
  function wrapStatement(sql: string, stmt: any): any {
    return new Proxy(stmt, {
      get(target, stmtProp) {
        const method = Reflect.get(target, stmtProp);
        if (typeof method !== "function") return method;
        // biome-ignore lint/suspicious/noExplicitAny: forwarding
        return (...stmtArgs: any[]) => {
          try {
            return (method as (...a: unknown[]) => unknown).apply(
              target,
              stmtArgs,
            );
          } catch (error) {
            if (!isStaleConnectionError(error)) throw error;
            reopen(error);
            // biome-ignore lint/suspicious/noExplicitAny: retry with fresh stmt
            const freshStmt = (current as any).prepare(sql);
            return (
              freshStmt as Record<string, (...args: unknown[]) => unknown>
            )[stmtProp as string].apply(freshStmt, stmtArgs);
          }
        };
      },
    });
  }

  const handler: ProxyHandler<QueryTaskDatabase> = {
    get(_, prop) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch
      const value = (current as any)[prop];
      if (typeof value !== "function") return value;
      if (prop === "prepare") {
        return (sql: string) => {
          try {
            // biome-ignore lint/suspicious/noExplicitAny: forwarding
            const stmt = (current as any).prepare(sql);
            return wrapStatement(sql, stmt);
          } catch (error) {
            if (!isStaleConnectionError(error)) throw error;
            reopen(error);
            // biome-ignore lint/suspicious/noExplicitAny: retry
            const stmt = (current as any).prepare(sql);
            return wrapStatement(sql, stmt);
          }
        };
      }
      return (...args: unknown[]) => {
        try {
          // biome-ignore lint/suspicious/noExplicitAny: forwarding
          return (value as any).apply(current, args);
        } catch (error) {
          if (!isStaleConnectionError(error)) throw error;
          reopen(error);
          // biome-ignore lint/suspicious/noExplicitAny: retry
          return (current as any)[prop as string].apply(current, args);
        }
      };
    },
  };

  return new Proxy({} as QueryTaskDatabase, handler);
}

export function createQueryTaskDatabase(filePath = DEFAULT_DB_PATH) {
  const db = openDatabase(filePath);
  return wrapResilient(filePath, db);
}

export function createInMemoryDb() {
  return createQueryTaskDatabase(":memory:");
}

/**
 * Preferred entry point going forward: returns a dialect-neutral adapter
 * whose `prepare/run/all/get/exec` calls are fully async. Selects between
 * SQLite and Postgres based on `DATABASE_URL`:
 *
 *   DATABASE_URL=postgres://…   → PostgresAdapter + applyPostgresSchema
 *   (unset) / file:… / :memory: → SqliteAdapter (wraps better-sqlite3)
 *
 * `sqliteFile` is respected only on the sqlite path.
 */
export async function createDatabaseAdapter(options?: {
  databaseUrl?: string;
  sqliteFile?: string;
}): Promise<DatabaseAdapter> {
  const url = options?.databaseUrl ?? process.env.DATABASE_URL;
  if (url?.startsWith("postgres")) {
    const pool = createPostgresPool(url);
    await applyPostgresSchema(pool);
    return new PostgresAdapter(pool);
  }
  return new SqliteAdapter(createQueryTaskDatabase(options?.sqliteFile));
}

/** Async convenience wrapper for tests that want an in-memory adapter. */
export function createInMemoryAdapter(): DatabaseAdapter {
  return new SqliteAdapter(createInMemoryDb());
}
